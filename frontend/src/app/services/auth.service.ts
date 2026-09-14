import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Usuario {
  email: string;
  nombre: string;
  role: string;
  foto?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  usuario: Usuario;
}

export interface RefreshResponse {
  success: boolean;
  token: string;
  usuario: Usuario;
}

export interface MeResponse {
  success: boolean;
  usuario: Usuario;
}

export interface GoogleLoginRequest {
  idToken: string;
}

const TOKEN_KEY = 'auth_token';
const USUARIO_KEY = 'auth_usuario';

/**
 * Foto de perfil elegida en la sesión actual (NO se persiste en el backend):
 * se conserva solo mientras dura la sesión y se borra al cerrar sesión.
 */
const FOTO_SESION_KEY = 'auth_foto_sesion';

/** Segundos antes de la expiración en que se muestra el aviso de cierre de sesión. */
export const AVISO_SEGUNDOS = 60;

/**
 * Margen (ms) antes de la expiración en que la sesión se renueva de forma
 * silenciosa si existe actividad reciente del usuario.
 */
const MARGEN_RENOVAR_MS = 5 * 60 * 1000;

/**
 * Ventana (ms) que se considera "actividad reciente": si el usuario tocó la
 * app dentro de este lapso, se considera activo y la sesión se renueva sola.
 */
const VENTANA_ACTIVIDAD_MS = 2 * 60 * 1000;

/** Cada cuánto se evalúa si corresponde renovar la sesión en silencio. */
const INTERVALO_RENOVAR_MS = 30 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  private expiracionTimer: ReturnType<typeof setTimeout> | null = null;
  private avisoTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private vigilanciaInterval: ReturnType<typeof setInterval> | null = null;
  private renovarInterval: ReturnType<typeof setInterval> | null = null;

  /** Timestamp (ms) de la última actividad detectada del usuario. */
  private ultimaActividad: number = Date.now();

  /**
   * Indica si el contador de expiración está pausado. Se pausa desde el login
   * hasta la primera interacción del usuario con la página: el token NO empieza
   * a venirse hasta que el usuario interactúa por primera vez.
   */
  private expiracionPausada: boolean = true;

  /** Aviso de cierre inminente: nombre del usuario y segundos restantes. */
  readonly avisoExpiracion = signal<{ nombre: string; segundos: number } | null>(null);

  /** Mensaje (personalizado) de sesión expirada. La UI reacciona para volver al login. */
  readonly sesionExpirada = signal<string | null>(null);

  /** Usuario de la sesión actual (reactive: la UI reacciona al cambiar foto, etc.). */
  readonly usuarioSesion = signal<Usuario | null>(this.getUsuario());

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((respuesta) => this.guardarSesion(respuesta.token, respuesta.usuario)),
    );
  }

  /** Renueva la sesión con un token nuevo y reprograma la expiración. */
  extenderSesion(): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>(`${this.apiUrl}/refresh`, {}).pipe(
      tap((respuesta) => {
        this.guardarSesion(respuesta.token, respuesta.usuario);
      }),
    );
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.apiUrl}/me`);
  }

  googleLogin(idToken: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/google`, { idToken }).pipe(
      tap((respuesta) => this.guardarSesion(respuesta.token, respuesta.usuario)),
    );
  }

  /**
   * Cambia la foto de perfil SOLO para la sesión actual: no se envía al
   * backend ni se persiste. Permanece visible hasta cerrar sesión y al volver
   * a entrar se muestra la foto guardada en la cuenta (o ninguna).
   */
  cambiarFotoLocal(foto: string): void {
    localStorage.setItem(FOTO_SESION_KEY, foto);
    this.aplicarFotoSesion();
  }

  getUsuario(): Usuario | null {
    const raw = localStorage.getItem(USUARIO_KEY);
    if (!raw) {
      return null;
    }
    try {
      const u = JSON.parse(raw) as Usuario;
      const fotoSesion = localStorage.getItem(FOTO_SESION_KEY);
      if (fotoSesion) {
        u.foto = fotoSesion;
      }
      return u;
    } catch {
      return null;
    }
  }

  /**
   * Reaplica la foto de sesión sobre el usuario archivo localStorage y sobre
   * el signal. Se llama tras guardarSesion (p.ej. renovación de token), para
   * que el refresh en silencio NO borre la foto elegida en la sesión.
   */
  private aplicarFotoSesion(): void {
    const foto = localStorage.getItem(FOTO_SESION_KEY);
    const actual = this.getUsuario();
    if (foto && actual) {
      this.actualizarDatosEnStorage({ ...actual, foto });
    }
  }

  /** Actualiza los datos mostrables del usuario en la sesión actual (sin llamar al backend). */
  actualizarDatos(nombre: string, email: string): void {
    const actual = this.getUsuario();
    if (!actual) {
      return;
    }
    this.actualizarDatosEnStorage({ ...actual, nombre, email });
  }

  private actualizarDatosEnStorage(usuario: Usuario): void {
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
    this.usuarioSesion.set(usuario);
  }

  isAuthenticated(): boolean {
    const token = this.token;
    const tokenExp = this.expiracion;
    return !!token && tokenExp !== null && tokenExp * 1000 > Date.now();
  }

  /**
   * Timestamp de expiración (segundos) del token actual.
   * Devuelve null si no hay token o si no se puede decodificar.
   */
  get expiracion(): number | null {
    const token = this.token;
    if (!token) {
      return null;
    }

    try {
      const payload = token.split('.')[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const json = JSON.parse(atob(padded));
      return typeof json.exp === 'number' ? json.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Programa el cierre de sesión automático y el aviso previo.
   * Si aún no hubo actividad del usuario, la cuenta queda en pausa y arrancará
   * con la primera interacción (ver registrarActividad).
   */
  iniciarVigilancia(): void {
    this.cerrarTimer();
    this.cerrarAviso();
    this.detenerVigilanciaInterval();
    this.detenerRenovarInterval();

    // Sliding session: mientras haya actividad reciente, renovar el token en
    // silencio antes de que expire para que la sesión no se cierre nunca.
    this.renovarInterval = setInterval(() => this.renovarSiHayActividad(), INTERVALO_RENOVAR_MS);

    // La cuenta de expiración solo comienza cuando el usuario interactúa.
    if (this.expiracionPausada) {
      return;
    }

    this.programarExpiracion();
  }

  /** Programa el aviso y el cierre de sesión según la expiración actual del token. */
  private programarExpiracion(): void {
    this.cerrarTimer();
    this.cerrarAviso();

    const tokenExp = this.expiracion;
    if (tokenExp === null) {
      return;
    }

    const ms = tokenExp * 1000 - Date.now();

    if (ms <= 0) {
      this.expirarSesion();
      return;
    }

    // Chequeo periódico: garantiza el cierre aunque el setTimeout se pierda
    this.vigilanciaInterval = setInterval(() => {
      if (!this.isAuthenticated()) {
        this.expirarSesion();
      }
    }, 1000);

    // Aviso unos segundos antes de que expire
    if (ms > AVISO_SEGUNDOS * 1000) {
      this.avisoTimer = setTimeout(() => this.mostrarAviso(), ms - AVISO_SEGUNDOS * 1000);
    }

    this.expiracionTimer = setTimeout(() => this.expirarSesion(), ms);
  }

  /**
   * Registra actividad del usuario (mouse, teclado, scroll, touch).
   * Si ya está visible el aviso de expiración, lo cancela y renueva la sesión
   * en silencio: la actividad reciente demuestra que sigue usando la app.
   */
registrarActividad(): void {
    this.ultimaActividad = Date.now();

    // Primera interacción: desbloquear la pausa y empezar a correr la
    // expiración del token (el token NO se vencía antes de interactuar).
    if (this.expiracionPausada) {
      this.expiracionPausada = false;
      this.programarExpiracion();
    }

    // Si el aviso ya apareció pero el usuario retomó actividad, cancelar
    // el cierre y renovar la sesión de inmediato.
    if (this.avisoExpiracion() !== null) {
      this.descartarAviso();
      this.renovarSesionEnSilencio();
      return;
    }

    this.renovarSiHayActividad();
  }

  /** Toca la marca de actividad sin renovar (útil al arrancar la detección). */
  marcarActividad(): void {
    this.ultimaActividad = Date.now();
  }

  private hayActividadReciente(): boolean {
    return Date.now() - this.ultimaActividad <= VENTANA_ACTIVIDAD_MS;
  }

  private renovarSiHayActividad(): void {
    if (!this.isAuthenticated()) {
      return;
    }
    if (!this.hayActividadReciente()) {
      return;
    }

    const tokenExp = this.expiracion;
    if (tokenExp === null) {
      return;
    }

    const ms = tokenExp * 1000 - Date.now();

    // Solo se renueva cuando el token está por expirar, no constantemente.
    if (ms <= MARGEN_RENOVAR_MS) {
      this.renovarSesionEnSilencio();
    }
  }

  private renovarSesionEnSilencio(): void {
    this.ultimaActividad = Date.now();

    this.extenderSesion().subscribe({
      error: () => {
        // Si el refresh falla (token ya inválido), la vigilancia se encargará
        // de cerrar la sesión cuando corresponda.
      },
    });
  }

  /** Oculta el aviso (el cierre de sesión sigue ocurriendo). */
  descartarAviso(): void {
    this.cerrarAviso();
  }

  cerrarSesion(): void {
    this.cerrarTimer();
    this.cerrarAviso();
    this.detenerVigilanciaInterval();
    this.detenerRenovarInterval();
    this.sesionExpirada.set(null);
    this.usuarioSesion.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
    localStorage.removeItem(FOTO_SESION_KEY);

    // Desactiva el one-tap/auto-selección de Google para que, al volver a
    // iniciar sesión, se muestre SIEMPRE el selector de cuentas y no quede
    // atascado con la sesión anterior.
    const gid = (window as any)?.google?.accounts?.id;
    if (gid && typeof gid.disableAutoSelect === 'function') {
      try {
        gid.disableAutoSelect();
      } catch {
        /* sin efecto si el SDK no está activo */
      }
    }
  }

  private guardarSesion(token: string, usuario: Usuario): void {
    this.sesionExpirada.set(null);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
    this.aplicarFotoSesion();
    this.usuarioSesion.set(this.getUsuario());
    this.iniciarVigilancia();
  }

  private mostrarAviso(): void {
    const nombre = this.getUsuario()?.nombre?.trim() || '';
    let restante = AVISO_SEGUNDOS;

    this.avisoExpiracion.set({ nombre, segundos: restante });

    this.countdownTimer = setInterval(() => {
      restante -= 1;

      if (restante <= 0) {
        this.expirarSesion();
        return;
      }

      this.avisoExpiracion.set({ nombre, segundos: restante });
    }, 1000);
  }

  private expirarSesion(): void {
    this.cerrarSesion();
    this.sesionExpirada.set('Tu sesión ha expirado. Vuelve a iniciar sesión.');
  }

  private cerrarAviso(): void {
    this.avisoExpiracion.set(null);

    if (this.avisoTimer !== null) {
      clearTimeout(this.avisoTimer);
      this.avisoTimer = null;
    }

    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private cerrarTimer(): void {
    if (this.expiracionTimer !== null) {
      clearTimeout(this.expiracionTimer);
      this.expiracionTimer = null;
    }
  }

  private detenerVigilanciaInterval(): void {
    if (this.vigilanciaInterval !== null) {
      clearInterval(this.vigilanciaInterval);
      this.vigilanciaInterval = null;
    }
  }

  private detenerRenovarInterval(): void {
    if (this.renovarInterval !== null) {
      clearInterval(this.renovarInterval);
      this.renovarInterval = null;
    }
  }
}
