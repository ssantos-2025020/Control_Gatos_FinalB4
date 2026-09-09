import { Component, Input } from '@angular/core';
import { LucideIconComponent } from '../lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-nota-informativa',
  standalone: true,
  imports: [LucideIconComponent],
  template: `
    <div class="nota-informativa">
      <lucide-icon name="info" [size]="15"></lucide-icon>
      <span>{{ texto }}</span>
    </div>
  `,
  styles: [
    `
      .nota-informativa {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 12px;
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        color: var(--text-muted);
        font-size: 12px;
        line-height: 1.5;
      }
      .nota-informativa lucide-icon {
        color: var(--blue-light);
        flex-shrink: 0;
      }
      .nota-informativa span { min-width: 0; }
    `,
  ],
})
export class NotaInformativaComponent {
  @Input() texto =
    'Los reportes se actualizan en tiempo real con la información de tus movimientos. Los datos reflejan el período seleccionado y los filtros aplicados.';
}