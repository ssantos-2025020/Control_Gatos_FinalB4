import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '../lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-alerta-presupuesto',
  standalone: true,
  imports: [CommonModule, LucideIconComponent],
  template: `
    <div class="alerta-banner" *ngIf="porcentaje > 0">
      <div class="alerta-icono">
        <lucide-icon [name]="'bell-ring'" [size]="20"></lucide-icon>
      </div>
      <div class="alerta-body">
        <strong>Atención</strong> — Has utilizado <strong>{{ porcentaje }}%</strong> de tu presupuesto de <strong>{{ nombreCategoria }}</strong>.
      </div>
      <button class="alerta-btn" (click)="verPresupuestos.emit()">Ver presupuestos</button>
    </div>
  `,
  styles: [`
    .alerta-banner {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 20px;
      background: var(--purple-bg);
      border: 1px solid var(--purple-border);
      border-radius: 14px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      animation: alerta-enter 0.35s ease-out;
    }

    @keyframes alerta-enter {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .alerta-icono {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--purple-icon-bg);
      flex-shrink: 0;
      font-size: 18px;
    }

    .alerta-body {
      flex: 1;
      font-size: 13px;
      color: var(--purple-light);
      line-height: 1.5;
    }

    .alerta-body strong {
      color: var(--text-primary);
    }

    .alerta-btn {
      flex-shrink: 0;
      background: var(--purple-btn-bg);
      border: 1px solid var(--purple-btn-border);
      color: var(--purple-light);
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .alerta-btn:hover {
      background: var(--purple-btn-hover-bg);
      border-color: var(--purple-btn-hover-border);
      color: var(--text-primary);
      box-shadow: 0 4px 16px var(--purple-btn-hover-shadow);
    }
  `],
})
export class AlertaPresupuestoComponent {
  @Input() nombreCategoria = '';
  @Input() porcentaje = 0;
  @Output() verPresupuestos = new EventEmitter<void>();
}
