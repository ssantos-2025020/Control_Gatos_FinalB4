import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UsuariosService, UsuarioRole } from '../../services/usuarios.service';
import { Usuario } from '../../models/usuario.model';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { LucideIconComponent } from '../../components/lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SidebarComponent, LucideIconComponent],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private usuariosService = inject(UsuariosService);
  private fb = inject(FormBuilder);

  usuarioActual = this.authService.getUsuario();

  usuarios = signal<Usuario[]>([]);
  filtroBusqueda = signal('');
  cargando = signal(false);
  errorMsg = signal<string | null>(null);

  mostrarModal = signal(false);
  usuarioEditando = signal<Usuario | null>(null);
  guardando = signal(false);
  formErrorMsg = signal<string | null>(null);
  toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  usuarioForm!: FormGroup;

  totalUsuarios = computed(() => this.usuarios().length);
  usuariosActivos = computed(() => this.usuarios().filter((u) => u.role === 'USER').length);
  administradores = computed(() => this.usuarios().filter((u) => u.role === 'ADMIN').length);

  usuariosFiltrados = computed(() => {
    const q = this.filtroBusqueda().trim().toLowerCase();
    if (!q) return this.usuarios();
    return this.usuarios().filter((u) =>
      u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  });

  inicialInicial(nombre?: string): string {
    return (nombre || '?').charAt(0).toUpperCase();
  }

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarUsuarios();
  }

  ngOnDestroy(): void {
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  /** Muestra una notificación tipo toast. */
  private mostrarToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2800);
  }

  /** Cierra el modal con la tecla Escape y evita propagación. */
  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cerrarModal();
    }
  }

  private inicializarFormulario(): void {
    this.usuarioForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(80)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['USER', Validators.required],
      password: ['', []],
    });
  }

  public cargarUsuarios(): void {
    this.cargando.set(true);
    this.errorMsg.set(null);

    this.usuariosService.getUsuariosCompletos().subscribe({
      next: (list) => {
        this.usuarios.set(list);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorMsg.set('No se pudieron cargar los usuarios.');
        console.error(err);
      },
    });
  }

  public abrirNuevoModal(): void {
    this.usuarioEditando.set(null);
    this.formErrorMsg.set(null);
    this.usuarioForm.reset({ role: 'USER' });
    this.usuarioForm.get('password')?.setValidators([Validators.required, Validators.minLength(4)]);
    this.mostrarModal.set(true);
  }

  public abrirEditarModal(usuario: Usuario): void {
    this.usuarioEditando.set(usuario);
    this.formErrorMsg.set(null);
    this.usuarioForm.reset({
      nombre: usuario.nombre,
      email: usuario.email,
      role: usuario.role,
      password: '',
    });
    this.usuarioForm.get('password')?.setValidators([]);
    this.mostrarModal.set(true);
  }

  public cerrarModal(): void {
    this.mostrarModal.set(false);
    this.usuarioEditando.set(null);
    this.formErrorMsg.set(null);
  }

  public guardarUsuario(): void {
    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      return;
    }

    const { nombre, email, role, password } = this.usuarioForm.value;
    const editando = this.usuarioEditando();

    this.guardando.set(true);

    if (editando) {
      const payload: Partial<{ nombre: string; email: string; role: UsuarioRole; password: string }> = {
        nombre,
        email,
        role,
      };
      if (password) {
        payload.password = password;
      }
      this.usuariosService.updateUsuario(editando.id, payload).subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarModal();
          this.mostrarToast('Cambios guardados correctamente');
          this.cargarUsuarios();
        },
        error: (err) => {
          this.guardando.set(false);
          this.formErrorMsg.set(err?.error?.message ?? 'Ocurrió un error al actualizar el usuario.');
        },
      });
      return;
    }

    this.usuariosService.createUsuario({ nombre, email, role, password }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModal();
        this.mostrarToast('Usuario creado correctamente');
        this.cargarUsuarios();
      },
      error: (err) => {
        this.guardando.set(false);
        this.formErrorMsg.set(err?.error?.message ?? 'Ocurrió un error al crear el usuario.');
      },
    });
  }

  public eliminarUsuario(usuario: Usuario): void {
    if (usuario.email === this.usuarioActual?.email) {
      alert('No puedes eliminar tu propio usuario.');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar a ${usuario.nombre}?`)) {
      return;
    }

    this.cargando.set(true);
    this.usuariosService.deleteUsuario(usuario.id).subscribe({
      next: () => {
        this.cargando.set(false);
        this.usuarios.update((list) => list.filter((u) => u.id !== usuario.id));
      },
      error: (err) => {
        this.cargando.set(false);
        alert(err?.error?.message ?? 'No se pudo eliminar el usuario.');
      },
    });
  }

  public esMiUsuario(usuario: Usuario): boolean {
    return usuario.email === this.usuarioActual?.email;
  }

  public esUltimoAdmin(usuario: Usuario): boolean {
    return usuario.role === 'ADMIN' && this.usuarios().filter((u) => u.role === 'ADMIN').length === 1;
  }

  get nombreInvalido(): boolean {
    const c = this.usuarioForm.get('nombre');
    return !!c && c.invalid && c.touched;
  }

  get emailInvalido(): boolean {
    const c = this.usuarioForm.get('email');
    return !!c && c.invalid && c.touched;
  }

  get esCreacion(): boolean {
    return !this.usuarioEditando();
  }
}