import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  protected authService = inject(AuthService);
  private router = inject(Router);

  /** Ancho base con el que Google dibuja el botón (350px cabe en la tarjeta). */
  private static readonly GOOGLE_IFRAME_BASE = 350;

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  cargando = signal(false);
  errorMensaje = signal<string | null>(null);
  mostrarPassword = signal(false);
  capsLockActivo = signal(false);
  anio = new Date().getFullYear();
  googleClientId = environment.googleClientId;
  googleCargado = signal(false);
  /** Evita inicializar el SDK de Google más de una vez por página. */
  private googleInicializado = false;
  private googleResizeHandler: (() => void) | null = null;

  ngOnDestroy(): void {
    if (this.googleResizeHandler) {
      window.removeEventListener('resize', this.googleResizeHandler);
      this.googleResizeHandler = null;
    }
  }

  ngOnInit(): void {
    // Si ya está autenticado, redirigir automáticamente al dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }

    // Si hay un mensaje de sesión expirada al cargar el login, mostrarlo
    const expMsg = this.authService.sesionExpirada();
    if (expMsg) {
      this.errorMensaje.set(expMsg);
    }

    // Cargar el SDK de Google y renderizar el botón oficial
    this.cargarGoogleSDK();
  }

  private cargarGoogleSDK(): void {
    // Verificar si ya está cargado
    if ((window as any).google) {
      this.renderizarBotonGoogle();
      return;
    }

    // Crear script dinámicamente
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;

    script.onload = () => this.renderizarBotonGoogle();
    script.onerror = () => {
      console.error('Error al cargar el script de Google');
      this.googleCargado.set(false);
    };

    document.head.appendChild(script);
  }

  /**
   * Inicializa Google Identity Services y renderiza el botón oficial
   * "Continuar con Google". Al usar el botón oficial (y no el prompt de
   * one-tap), al hacer clic SIEMPRE se abre el selector de cuentas de
   * Google — tanto sin sesión previa como después de cerrar sesión — y
   * nunca se auto-loguea en silencio (auto_select: false).
   */
  private renderizarBotonGoogle(): void {
    const gid = (window as any)?.google?.accounts?.id;
    if (!gid) {
      this.errorMensaje.set('El SDK de Google no está disponible. Recarga la página.');
      return;
    }

    try {
      if (!this.googleInicializado) {
        gid.initialize({
          client_id: this.googleClientId,
          callback: (response: any) => this.handleGoogleLogin(response?.credential),
          auto_select: false,
          cancel_on_tap_outside: false,
        });
        this.googleInicializado = true;
      }

      const host = document.getElementById('google-signin-button');
      if (host) {
        gid.renderButton(host, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: LoginComponent.GOOGLE_IFRAME_BASE,
        });
        this.googleCargado.set(true);

        // El iframe de Google tiene un tamaño fijo; se escala con JS para que
        // SIEMPRE quede dentro de su marco, pase lo que pase con el ancho.
        requestAnimationFrame(() => this.ajustarEscalaGoogle());

        if (!this.googleResizeHandler) {
          this.googleResizeHandler = () => this.ajustarEscalaGoogle();
          window.addEventListener('resize', this.googleResizeHandler);
        }
      } else {
        this.googleCargado.set(false);
      }
    } catch (error) {
      console.error('Error al inicializar Google Sign-In:', error);
      this.googleCargado.set(false);
    }
  }

  private ajustarEscalaGoogle(): void {
    const host = document.getElementById('google-signin-button');
    const iframe = host?.querySelector('iframe');
    if (!host || !iframe) {
      return;
    }

    const estilos = getComputedStyle(host);
    const anchoUtil =
      host.clientWidth -
      parseFloat(estilos.paddingLeft || '0') -
      parseFloat(estilos.paddingRight || '0');

    const escala = Math.min(1, anchoUtil / LoginComponent.GOOGLE_IFRAME_BASE);
    iframe.style.transform = `translate(-50%, -50%) scale(${escala})`;
  }

  togglePassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  /** Detecta si Bloq Mayús está activado mientras se escribe la contraseña. */
  detectarCapsLock(event: KeyboardEvent): void {
    const esLetra = event.key.length === 1 && /[a-zA-Z]/.test(event.key);
    if (!esLetra) {
      return;
    }
    this.capsLockActivo.set(event.getModifierState('CapsLock'));
  }

  /** Inclina la tarjeta siguiendo el mouse (efecto 3D). */
  cardTilt(event: MouseEvent): void {
    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty('--rotate-y', `${px * 8}deg`);
    card.style.setProperty('--rotate-x', `${-py * 8}deg`);
  }

  cardReset(): void {
    const card = document.querySelector('.login-panel-inner') as HTMLElement | null;
    if (!card) return;
    card.style.setProperty('--rotate-y', '0deg');
    card.style.setProperty('--rotate-x', '0deg');
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.errorMensaje.set(null);

    const { email, password } = this.loginForm.getRawValue();

    this.authService.login(email!, password!).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorMensaje.set(
          err?.error?.message ?? 'No se pudo iniciar sesión. Intenta nuevamente.',
        );
      },
    });
  }

  handleGoogleLogin(credential: string): void {
    this.cargando.set(true);
    this.errorMensaje.set(null);

    this.authService.googleLogin(credential).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorMensaje.set(
          err?.error?.message ?? 'No se pudo iniciar sesión con Google. Intenta nuevamente.',
        );
      },
    });
  }

  get emailInvalido(): boolean {
    const c = this.loginForm.controls.email;
    return (c.touched || c.dirty) && !!c.errors;
  }

  get emailValido(): boolean {
    const c = this.loginForm.controls.email;
    return c.valid && (c.touched || c.dirty);
  }

  get passwordInvalido(): boolean {
    const c = this.loginForm.controls.password;
    return (c.touched || c.dirty) && !!c.errors;
  }

  get passwordValido(): boolean {
    const c = this.loginForm.controls.password;
    return c.valid && (c.touched || c.dirty);
  }
}
