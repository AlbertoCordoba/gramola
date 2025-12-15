import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { Registro } from './components/registro/registro';
import { Gramola } from './components/gramola/gramola';
import { PagosComponent } from './components/pagos/pagos.component';
import { PasarelaPagoComponent } from './components/pasarela-pago/pasarela-pago.component';
import { SeleccionPlaylistComponent } from './components/seleccion-playlist/seleccion-playlist.component';
// 1. IMPORTAR LOS COMPONENTES QUE FALTAN
import { RecuperarPasswordComponent } from './components/recuperar-password/recuperar-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: Registro },
  { path: 'config-audio', component: SeleccionPlaylistComponent },
  { path: 'gramola', component: Gramola },
  { path: 'pagos', component: PagosComponent },
  { path: 'pasarela', component: PasarelaPagoComponent },
  // 2. AÑADIR LAS RUTAS AQUÍ
  { path: 'recuperar-password', component: RecuperarPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent } // Necesaria para cuando hagan clic en el link del email
];