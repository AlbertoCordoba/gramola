/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es el componente de registro ('Registro'). Permite crear una nueva cuenta de bar.
 * A diferencia de un formulario normal, este incluye dos características avanzadas:
 * 1. Firma Digital Manuscrita (Canvas API).
 * 2. Geolocalización automática (Navigator API).
 *
 * * PUNTOS CLAVE:
 * 1. MANIPULACIÓN DEL DOM (@ViewChild):
 * Angular suele abstraernos del DOM, pero para dibujar necesitamos acceso directo al
 * elemento HTML <canvas>. Usamos el decorador '@ViewChild' para obtener esa referencia
 * de forma segura y tipada ('ElementRef<HTMLCanvasElement>').
 *
 * 2. CICLO DE VIDA (ngAfterViewInit):
 * No podemos inicializar el Canvas en 'ngOnInit' porque el HTML aún no existe.
 * Usamos el hook 'ngAfterViewInit', que garantiza que la vista ya se ha renderizado,
 * para obtener el contexto de dibujo 2D ('getContext').
 *
 * 3. EVENTOS DUALES (Ratón y Táctil):
 * Para que la firma funcione en móviles y ordenadores, escuchamos tanto eventos de
 * ratón ('mousedown') como táctiles ('touchstart'). Es vital usar 'preventDefault()'
 * en los táctiles para que al firmar no se mueva la pantalla del móvil.
 *
 * 4. SERIALIZACIÓN (toDataURL):
 * El dibujo son píxeles. Para enviarlo al servidor Java, lo convertimos a un String
 * en formato Base64 (PNG) usando el método nativo 'canvas.toDataURL()'.
 * ======================================================================================
 */

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
  // --- INYECCIÓN DE DEPENDENCIAS ---
  private barService = inject(BarService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // Para refrescar la vista manualmente si hace falta

  // --- ACCESO AL DOM (CANVAS) ---
  // Buscamos en el HTML el elemento con la etiqueta #firmaCanvas
  @ViewChild('firmaCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  // Contexto de dibujo 2D (nuestro "pincel" virtual)
  private cx!: CanvasRenderingContext2D | null;
  private isDrawing = false; // Flag para saber si el botón del ratón está pulsado

  // Modelo de datos del formulario
  registroData = {
    nombre: '',
    email: '',
    password: '',
    confirmPassword: '',
    latitud: 0,
    longitud: 0,
    firmaBase64: '' // Aquí guardaremos la imagen de la firma convertida a texto
  };

  // Estado de la interfaz
  errorMessage: string = '';
  enviado: boolean = false; // Controla si mostramos el formulario o el mensaje de éxito
  cargando: boolean = false;

  // --- INICIALIZACIÓN DEL CANVAS ---
  // Se ejecuta DESPUÉS de que Angular haya pintado el HTML.
  ngAfterViewInit() {
    // Si ya enviamos el formulario, el canvas desaparece, así que comprobamos si existe.
    if (!this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    this.cx = canvas.getContext('2d'); // Obtenemos la API de dibujo 2D
    if (!this.cx) return;
    
    // Configuración del trazo
    this.cx.lineWidth = 3;
    this.cx.lineCap = 'round'; // Bordes redondeados para que la firma sea suave
    this.cx.strokeStyle = '#000'; // Color negro

    // --- LISTENERS DE RATÓN (PC) ---
    // Usamos arrow functions () => para no perder el contexto 'this'
    canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    canvas.addEventListener('mousemove', (e) => this.draw(e));
    canvas.addEventListener('mouseup', () => this.stopDrawing());
    canvas.addEventListener('mouseleave', () => this.stopDrawing()); // Si sale del recuadro, paramos

    // --- LISTENERS TÁCTILES (MÓVIL) ---
    canvas.addEventListener('touchstart', (e) => { 
      e.preventDefault(); // IMPORTANTE: Evita que la página haga scroll al firmar
      this.startDrawing(e.touches[0]); // Usamos el primer dedo que toca
    });
    canvas.addEventListener('touchmove', (e) => { 
      e.preventDefault(); 
      this.draw(e.touches[0]); 
    });
    canvas.addEventListener('touchend', () => this.stopDrawing());
  }

  // --- LÓGICA DE DIBUJO ---
  
  private startDrawing(e: any) {
    this.isDrawing = true;
    this.draw(e); // Dibuja un punto inicial
  }

  private draw(e: any) {
    if (!this.isDrawing || !this.cx) return;
    
    // Obtenemos la posición exacta del canvas en la pantalla
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    
    // Calculamos la coordenada relativa (Posición Ratón - Posición Borde Canvas)
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Dibujamos una línea desde la posición anterior hasta la actual
    this.cx.lineTo(x, y);
    this.cx.stroke();
    
    // Movemos el "cursor" del contexto a la nueva posición para el siguiente trazo
    this.cx.beginPath();
    this.cx.moveTo(x, y);
  }

  private stopDrawing() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.cx?.beginPath(); // Reseteamos el trazo para no unir líneas separadas
    this.guardarImagen(); // Cada vez que levanta el lápiz, actualizamos el Base64
  }

  // --- UTILIDADES DE FIRMA ---

  // Convierte los píxeles a string (PNG Base64)
  guardarImagen() {
    if (this.canvasRef && this.canvasRef.nativeElement) {
      // toDataURL devuelve algo como: "data:image/png;base64,iVBORw0KGgo..."
      this.registroData.firmaBase64 = this.canvasRef.nativeElement.toDataURL('image/png');
    }
  }

  // Botón "Borrar Firma"
  limpiarFirma() {
    if (!this.cx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    // Borra un rectángulo del tamaño de todo el canvas
    this.cx.clearRect(0, 0, canvas.width, canvas.height);
    this.registroData.firmaBase64 = ''; // Limpiamos también el dato
  }

  // --- GEOLOCALIZACIÓN ---
  obtenerUbicacion() {
    this.errorMessage = '';
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        // ÉXITO: Guardamos coordenadas
        this.registroData.latitud = pos.coords.latitude;
        this.registroData.longitud = pos.coords.longitude;
        
        // Forzamos actualización de la vista (Angular a veces no detecta cambios en callbacks nativos)
        this.cdr.detectChanges(); 
      }, (err) => {
        this.errorMessage = 'Error obteniendo ubicación. Asegúrate de dar permisos.';
        this.cdr.detectChanges();
      });
    } else {
      this.errorMessage = 'Tu navegador no soporta geolocalización.';
    }
  }

  // --- ENVÍO DEL FORMULARIO ---
  onRegistro() {
    this.errorMessage = '';
    
    // Validación de contraseñas iguales
    if (this.registroData.password !== this.registroData.confirmPassword) {
      this.errorMessage = 'Contraseñas no coinciden.';
      return;
    }

    this.cargando = true; // Bloqueo de UI

    // Llamada al servicio
    this.barService.registro(this.registroData).subscribe({
      next: () => {
        // ÉXITO: Cambiamos a la vista de confirmación
        this.enviado = true;
        this.cargando = false;
        
        this.cdr.detectChanges();

        // Redirección automática tras 4 segundos para mejor UX
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 4000);
      },
      error: (e) => {
        // ERROR: Mostramos el mensaje que viene del backend (ej: "Email ya existe")
        this.cargando = false;
        this.errorMessage = e.error?.error || 'Error en registro.';
        this.cdr.detectChanges();
      }
    });
  }
}