import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideIconComponent } from '../lucide-icon/lucide-icon.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, LucideIconComponent],
  template: `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <img src="assets/Logo sinfondo.png" alt="Legatus" class="sidebar-logo" />
      </div>

      <nav class="sidebar-nav">
        <a class="nav-link" routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <lucide-icon [name]="'layout-grid'" [size]="18" class="nav-icon"></lucide-icon> Dashboard
        </a>
        <a class="nav-link" routerLink="/ingresos" routerLinkActive="active">
          <lucide-icon [name]="'trending-up'" [size]="18" class="nav-icon"></lucide-icon> Ingresos
        </a>
        <a class="nav-link" routerLink="/gastos" routerLinkActive="active">
          <lucide-icon [name]="'trending-down'" [size]="18" class="nav-icon"></lucide-icon> Gastos
        </a>
        <a class="nav-link" routerLink="/presupuestos" routerLinkActive="active">
          <lucide-icon [name]="'pie-chart'" [size]="18" class="nav-icon"></lucide-icon> Presupuestos
        </a>
        <a class="nav-link" routerLink="/categorias" routerLinkActive="active">
          <lucide-icon [name]="'tag'" [size]="18" class="nav-icon"></lucide-icon> Categorías
        </a>
        <a class="nav-link" routerLink="/reportes" routerLinkActive="active">
          <lucide-icon [name]="'bar-chart-3'" [size]="18" class="nav-icon"></lucide-icon> Reportes
        </a>
        <a class="nav-link" routerLink="/usuarios" routerLinkActive="active">
          <lucide-icon [name]="'users'" [size]="18" class="nav-icon"></lucide-icon> Usuarios
        </a>
        <a class="nav-link" routerLink="/configuracion" routerLinkActive="active">
          <lucide-icon [name]="'settings'" [size]="18" class="nav-icon"></lucide-icon> Configuración
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="user-chip">
          <div class="user-chip-avatar">{{ usuario?.nombre?.charAt(0) }}</div>
<div class="user-chip-info">
            <span class="user-chip-name">{{ usuario?.nombre }}</span>
            <span class="user-chip-role" [class.admin]="usuario?.role === 'ADMIN'">{{ usuario?.role }}</span>
          </div>
        </div>
        <button (click)="cerrarSesion()" class="btn-logout">
          <lucide-icon [name]="'log-out'" [size]="15"></lucide-icon> Cerrar sesión
        </button>
      </div>
    </aside>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

    .sidebar {
      width: var(--sidebar-w, 240px);
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      padding: 0 15px 20px;
      background: linear-gradient(180deg, #0a0e1a 0%, #0d1224 55%, #111a36 100%);
      border-right: 1px solid var(--glass-border);
      position: sticky;
      top: 0;
      height: 100vh;
      box-sizing: border-box;
      z-index: 600;
    }

    .sidebar-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 18px 10px 16px;
      border-radius: 0 0 14px 14px;
      text-align: center;
      background: transparent;
      border: 0;
    }

    .sidebar-logo {
      width: 176px;
      max-width: 100%;
      height: auto;
      border-radius: 16px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .sidebar-brand h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
      line-height: 1;
      background: var(--gradient-brand-text);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .sidebar-subtitle {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 500;
      margin-top: 3px;
    }

    .sidebar-nav {
      margin-top: 18px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 13px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: 0.1px;
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      text-decoration: none;
      border: none;
      outline: none;
    }

    .nav-link:hover {
      background: var(--glass-hover);
      color: var(--text-primary);
      text-decoration: none;
    }

    .nav-link.active {
      background: var(--blue-active-gradient, linear-gradient(90deg, #1268ff, #00b9e8));
      color: #ffffff;
      box-shadow: 0 8px 20px rgba(18, 104, 255, .3);
      text-decoration: none;
    }

    .nav-icon {
      font-size: 15px;
      width: 20px;
      text-align: center;
    }

    .sidebar-footer {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid var(--glass-border);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 6px;
    }

    .user-chip-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--gradient-brand);
      color: var(--text-white);
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
    }

    .user-chip-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .user-chip-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-slate-300);
    }

    .user-chip-role {
      align-self: flex-start;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-placeholder);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      padding: 1px 8px;
      border-radius: 999px;
      margin-top: 2px;
    }

    .user-chip-role.admin {
      color: var(--blue-light, #6ea8ff);
      background: var(--blue-bg);
      border-color: var(--blue-border);
    }

    .btn-logout {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: transparent;
      border: 1px solid var(--glass-border-strong);
      color: var(--text-muted);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-logout:hover {
      background: var(--red-alert-bg);
      border-color: var(--red-alert-border);
      color: var(--text-error);
    }
  `]
})
export class SidebarComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  usuario = this.authService.getUsuario();

  cerrarSesion(): void {
    this.authService.cerrarSesion();
    this.router.navigate(['/login']);
  }
}
