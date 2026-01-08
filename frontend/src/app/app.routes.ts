import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { Registro } from './components/registro/registro';
import { Gramola } from './components/gramola/gramola';
import { PagosComponent } from './components/pagos/pagos.component';
import { PasarelaPagoComponent } from './components/pasarela-pago/pasarela-pago.component';
import { SeleccionPlaylistComponent } from './components/seleccion-playlist/seleccion-playlist.component';
import { RecuperarPasswordComponent } from './components/recuperar-password/recuperar-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { CallbackComponent } from './components/callback/callback.component'; // <--- IMPORTAR
import { authPublicGuard } from './guards/auth-public.guards';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  
  // Rutas Públicas
  { path: 'login', component: LoginComponent, canActivate: [authPublicGuard] },
  { path: 'registro', component: Registro, canActivate: [authPublicGuard] },
  { path: 'recuperar-password', component: RecuperarPasswordComponent, canActivate: [authPublicGuard] },

  // Rutas Privadas
  { path: 'config-audio', component: SeleccionPlaylistComponent },
  { path: 'gramola', component: Gramola },
  { path: 'pagos', component: PagosComponent },
  { path: 'pasarela', component: PasarelaPagoComponent },
  { path: 'reset-password', component: ResetPasswordComponent },

  // --- RUTA NECESARIA PARA SPOTIFY ---
  { path: 'callback', component: CallbackComponent } 
];