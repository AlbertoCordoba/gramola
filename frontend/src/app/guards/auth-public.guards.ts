import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authPublicGuard: CanActivateFn = (route, state) => {
  // Inyección de dependencias dentro de una función (sin constructor)
  const router = inject(Router);
  
  // 1. VERIFICACIÓN DE SESIÓN
  // Comprobamos si hay un usuario guardado en el almacenamiento local del navegador.
  const usuario = localStorage.getItem('usuarioBar');

  // Esta guardia solo se usa para proteger rutas públicas.
  // Si hay una sesión antigua en localStorage y el usuario entra desde un enlace
  // de verificación/pago, NO debemos forzar redirecciones inesperadas.
  if (usuario) {
    const url = state.url || '';
    const isAuthPage = url.startsWith('/login') || url.startsWith('/registro') || url.startsWith('/recuperar-password');
    if (isAuthPage) {
      router.navigate(['/config-audio']);
      return false;
    }
  }

  // CASO B: USUARIO ANÓNIMO
  // Si no hay sesión, permitimos el paso (return true).
  // El usuario podrá ver el formulario de Login o Registro.
  return true;
};