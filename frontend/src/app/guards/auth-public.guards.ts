import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authPublicGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // Verificamos si existe el usuario en el localStorage
  const usuario = localStorage.getItem('usuarioBar');

  if (usuario) {
    // Si ya está logeado, lo mandamos a la página principal de la app
    router.navigate(['/config-audio']);
    return false; // Bloquea el acceso a la ruta original (login/registro)
  }

  // Si no está logeado, permitimos que entre al login o registro
  return true;
};