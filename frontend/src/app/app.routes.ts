/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * Define las reglas de navegación. Angular lee este array de arriba a abajo.
 * La primera coincidencia gana.
 * ======================================================================================
 */

import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { Registro } from './components/registro/registro';
import { Gramola } from './components/gramola/gramola';
import { PagosComponent } from './components/pagos/pagos.component';
import { PasarelaPagoComponent } from './components/pasarela-pago/pasarela-pago.component';
import { SeleccionPlaylistComponent } from './components/seleccion-playlist/seleccion-playlist.component';
import { RecuperarPasswordComponent } from './components/recuperar-password/recuperar-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';

// Guard personalizado: Evita que un usuario logueado vuelva a entrar a páginas públicas
import { authPublicGuard } from './guards/auth-public.guards';

export const routes: Routes = [
  // --- RUTA POR DEFECTO ---
  // Si la URL está vacía (root), redirigimos automáticamente al login.
  // 'pathMatch: full' es vital aquí: asegura que solo coincida si la URL es EXACTAMENTE vacía,
  // no si es parte de otra ruta.
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  
  // --- RUTAS PÚBLICAS (CON GUARD INVERSO) ---
  // Estas rutas tienen 'canActivate: [authPublicGuard]'.
  // LÓGICA: Si el usuario YA tiene sesión iniciada (token en localStorage),
  // este Guard devuelve FALSE y lo redirige a '/config-audio'.
  // Esto evita que alguien logueado vea el formulario de registro o login de nuevo.
  { 
    path: 'login', 
    component: LoginComponent, 
    canActivate: [authPublicGuard] 
  },
  { 
    path: 'registro', 
    component: Registro, 
    canActivate: [authPublicGuard] 
  },
  { 
    path: 'recuperar-password', 
    component: RecuperarPasswordComponent, 
    canActivate: [authPublicGuard] 
  },

  // --- RUTAS PRIVADAS (FUNCIONALIDAD DE LA APP) ---
  // Estas son las pantallas de la aplicación real.
  // Nota: En tu código actual no tienen un 'AuthGuard' explícito aquí, 
  // pero la lógica de redirección suele estar en el componente o en un interceptor.
  
  // Selección de playlist de ambiente (Spotify)
  { path: 'config-audio', component: SeleccionPlaylistComponent },
  
  // La pantalla principal del reproductor
  { path: 'gramola', component: Gramola },
  
  // Selección de suscripción (Mensual/Anual)
  { path: 'pagos', component: PagosComponent },
  
  // Pasarela de pago simulada
  { path: 'pasarela', component: PasarelaPagoComponent },
  
  // Pantalla para establecer nueva contraseña (viene desde el email)
  { path: 'reset-password', component: ResetPasswordComponent }
];