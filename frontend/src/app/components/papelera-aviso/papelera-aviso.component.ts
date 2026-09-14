import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { LucideIconComponent } from '../lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-papelera-aviso',
  standalone: true,
  imports: [LucideIconComponent],
  templateUrl: './papelera-aviso.component.html',
  styleUrls: ['./papelera-aviso.component.css'],
})
export class PapeleraAvisoComponent {
  private router = inject(Router);

  mensaje = input.required<string>();
  cerrar = output<void>();

  irAPapelera(): void {
    this.cerrar.emit();
    this.router.navigate(['/configuracion'], { queryParams: { seccion: 'papelera' } });
  }
}