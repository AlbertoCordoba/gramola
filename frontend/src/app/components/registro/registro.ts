import { Component, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BarService } from '../../services/bar';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class Registro implements AfterViewInit {
  private barService = inject(BarService);
  private router = inject(Router);

  // Referencia al Canvas
  @ViewChild('firmaCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private cx!: CanvasRenderingContext2D | null;
  private isDrawing = false;

  registroData = {
    nombre: '',
    email: '',
    password: '',
    confirmPassword: '',
    latitud: 0,
    longitud: 0,
    firmaBase64: '' // Aquí guardamos la imagen
  };

  errorMessage: string = '';
  successMessage: string = '';

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.cx = canvas.getContext('2d');

    if (!this.cx) return;

    this.cx.lineWidth = 3;
    this.cx.lineCap = 'round';
    this.cx.strokeStyle = '#000';

    // Eventos Ratón
    canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    canvas.addEventListener('mousemove', (e) => this.draw(e));
    canvas.addEventListener('mouseup', () => this.stopDrawing());
    canvas.addEventListener('mouseleave', () => this.stopDrawing());

    // Eventos Táctiles (Móvil)
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.startDrawing(e.touches[0]); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.draw(e.touches[0]); });
    canvas.addEventListener('touchend', () => this.stopDrawing());
  }

  private startDrawing(e: any) {
    this.isDrawing = true;
    this.draw(e);
  }

  private draw(e: any) {
    if (!this.isDrawing || !this.cx) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.cx.lineTo(x, y);
    this.cx.stroke();
    this.cx.beginPath();
    this.cx.moveTo(x, y);
  }

  private stopDrawing() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.cx?.beginPath();
    this.guardarImagen();
  }

  guardarImagen() {
    this.registroData.firmaBase64 = this.canvasRef.nativeElement.toDataURL('image/png');
  }

  limpiarFirma() {
    if (!this.cx) return;
    const canvas = this.canvasRef.nativeElement;
    this.cx.clearRect(0, 0, canvas.width, canvas.height);
    this.registroData.firmaBase64 = '';
  }

  obtenerUbicacion() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        this.registroData.latitud = pos.coords.latitude;
        this.registroData.longitud = pos.coords.longitude;
        alert('Ubicación detectada.');
      }, () => alert('Error obteniendo ubicación.'));
    }
  }

  onRegistro() {
    if (this.registroData.password !== this.registroData.confirmPassword) {
      this.errorMessage = 'Contraseñas no coinciden.';
      return;
    }

    this.barService.registro(this.registroData).subscribe({
      next: () => {
        this.successMessage = '¡Cuenta creada! Revisa tu email.';
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (e) => this.errorMessage = e.error?.error || 'Error en registro.'
    });
  }
}