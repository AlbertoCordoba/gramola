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
    
    clientId: '',
    clientSecret: '',
    
    latitud: 0,
    longitud: 0,
    firmaBase64: '' 
  };

  errorMessage: string = '';
  enviado: boolean = false; 
  cargando: boolean = false;

  // MÉTODO DE INICIALIZACIÓN: Configura el pincel del Canvas y escucha eventos de ratón/táctiles.
  ngAfterViewInit() {
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

    canvas.addEventListener('touchstart', (e) => { 
      e.preventDefault(); 
      this.startDrawing(e.touches[0]); 
    });
    canvas.addEventListener('touchmove', (e) => { 
      e.preventDefault(); 
      this.draw(e.touches[0]); 
    });
    canvas.addEventListener('touchend', () => this.stopDrawing());
  }
  // MÉTODO: Se activa al pulsar el ratón o tocar la pantalla. 
  // Marca 'isDrawing' como verdadero para permitir que el trazo comience.
  private startDrawing(e: any) {
    this.isDrawing = true;
    this.draw(e); 
  }
  // MÉTODOS DE DIBUJO: Capturan el movimiento del trazo y lo pintan en el lienzo en tiempo real.
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
  // MÉTODO: Se activa al soltar el clic o levantar el dedo. 
  // Detiene el proceso de dibujo y llama a 'guardarImagen' para actualizar el Base64.
  private stopDrawing() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.cx?.beginPath(); 
    this.guardarImagen(); 
  }
  // MÉTODO: Convierte el dibujo del Canvas en un string Base64 para enviarlo como imagen al Backend.
  guardarImagen() {
    if (this.canvasRef && this.canvasRef.nativeElement) {
      this.registroData.firmaBase64 = this.canvasRef.nativeElement.toDataURL('image/png');
    }
  }
  // MÉTODO: Limpia por completo el lienzo del Canvas y resetea el string de la imagen.
  limpiarFirma() {
    if (!this.cx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    this.cx.clearRect(0, 0, canvas.width, canvas.height);
    this.registroData.firmaBase64 = ''; 
  }
  // MÉTODO: Captura las coordenadas reales del local para la futura validación del login.
  obtenerUbicacion() {
    this.errorMessage = '';
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        this.registroData.latitud = pos.coords.latitude;
        this.registroData.longitud = pos.coords.longitude;
        this.cdr.detectChanges(); 
      }, (err) => {
        this.errorMessage = 'Error obteniendo ubicación. Asegúrate de dar permisos.';
        this.cdr.detectChanges();
      });
    } else {
      this.errorMessage = 'Tu navegador no soporta geolocalización.';
    }
  }
  // MÉTODO PRINCIPAL: Valida los campos y envía el objeto completo al servidor para crear la cuenta.
  onRegistro() {
    this.errorMessage = '';
    
    if (this.registroData.password !== this.registroData.confirmPassword) {
      this.errorMessage = 'Contraseñas no coinciden.';
      return;
    }
    
    // Validación extra simple
    if (!this.registroData.clientId || !this.registroData.clientSecret) {
        this.errorMessage = 'Debes introducir las credenciales de Spotify.';
        return;
    }

    this.cargando = true; 

    this.barService.registro(this.registroData).subscribe({
      next: () => {
        this.enviado = true;
        this.cargando = false;
        this.cdr.detectChanges();
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