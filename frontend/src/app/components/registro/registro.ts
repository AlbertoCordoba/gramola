import { Component, inject, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);

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
    firmaBase64: '' 
  };

  errorMessage: string = '';
  // Variables para controlar la vista de éxito
  enviado: boolean = false;
  cargando: boolean = false;

  ngAfterViewInit() {
    // Es posible que el canvas no exista si 'enviado' es true, así que validamos
    if (!this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    this.cx = canvas.getContext('2d');
    if (!this.cx) return;
    this.cx.lineWidth = 3;
    this.cx.lineCap = 'round';
    this.cx.strokeStyle = '#000';

    canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    canvas.addEventListener('mousemove', (e) => this.draw(e));
    canvas.addEventListener('mouseup', () => this.stopDrawing());
    canvas.addEventListener('mouseleave', () => this.stopDrawing());

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
    if (this.canvasRef && this.canvasRef.nativeElement) {
      this.registroData.firmaBase64 = this.canvasRef.nativeElement.toDataURL('image/png');
    }
  }

  limpiarFirma() {
    if (!this.cx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    this.cx.clearRect(0, 0, canvas.width, canvas.height);
    this.registroData.firmaBase64 = '';
  }

  obtenerUbicacion() {
    this.errorMessage = '';
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        this.registroData.latitud = pos.coords.latitude;
        this.registroData.longitud = pos.coords.longitude;
        // Forzamos actualización de la vista para mostrar las coordenadas
        this.cdr.detectChanges(); 
      }, (err) => {
        this.errorMessage = 'Error obteniendo ubicación. Asegúrate de dar permisos.';
        this.cdr.detectChanges();
      });
    } else {
      this.errorMessage = 'Tu navegador no soporta geolocalización.';
    }
  }

  onRegistro() {
    this.errorMessage = '';
    
    if (this.registroData.password !== this.registroData.confirmPassword) {
      this.errorMessage = 'Contraseñas no coinciden.';
      return;
    }

    this.cargando = true; // Bloqueamos el botón y inputs

    this.barService.registro(this.registroData).subscribe({
      next: () => {
        // 1. ÉXITO: Cambiamos a la vista de confirmación
        this.enviado = true;
        this.cargando = false;
        
        // Forzamos a Angular a pintar la nueva vista inmediatamente
        this.cdr.detectChanges();

        // 2. Esperamos 4 segundos y redirigimos
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 4000);
      },
      error: (e) => {
        this.cargando = false;
        this.errorMessage = e.error?.error || 'Error en registro.';
        this.cdr.detectChanges();
      }
    });
  }
}