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