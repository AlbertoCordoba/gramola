/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es un Guard de tipo 'CanActivateFn'. Actúa como un interceptor de navegación.
 * Se ejecuta ANTES de que Angular cargue una ruta.
 *
 * * PUNTOS CLAVE PARA EL TRIBUNAL:
 * 1. PROTECCIÓN INVERSA:
 * Normalmente los guards se usan para evitar que entres si NO estás logueado.
 * Este hace lo contrario: evita que entres al '/login' o '/registro' si YA ESTÁS
 * logueado.
 *
 * 2. MEJORA DE UX (Experiencia de Usuario):
 * Si un usuario ya tiene la sesión abierta y escribe manualmente "localhost:4200/login",
 * sería confuso mostrarle el formulario de nuevo. Este guard detecta la sesión activa
 * y lo redirige automáticamente al panel de control ('/config-audio').
 *
 * 3. STYLE FUNCIONAL (Modern Angular):
 * En lugar de una clase con @Injectable, usamos una función flecha (arrow function)
 * 'CanActivateFn' y la función 'inject()', que es la forma moderna y menos verbosa
 * de escribir guards en Angular 16+.
 * ======================================================================================
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authPublicGuard: CanActivateFn = (route, state) => {
  // Inyección de dependencias dentro de una función (sin constructor)
  const router = inject(Router);
  
  // 1. VERIFICACIÓN DE SESIÓN
  // Comprobamos si hay un usuario guardado en el almacenamiento local del navegador.
  const usuario = localStorage.getItem('usuarioBar');

  if (usuario) {
    // CASO A: USUARIO LOGUEADO
    // Si ya existe sesión, NO tiene sentido que vea el Login o Registro.
    // Lo redirigimos a la página principal de configuración.
    router.navigate(['/config-audio']);
    
    // Devolvemos FALSE para cancelar la navegación a la ruta original (/login).
    return false; 
  }

  // CASO B: USUARIO ANÓNIMO
  // Si no hay sesión, permitimos el paso (return true).
  // El usuario podrá ver el formulario de Login o Registro.
  return true;
};