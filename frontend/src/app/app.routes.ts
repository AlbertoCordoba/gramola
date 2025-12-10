import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { Registro } from './components/registro/registro';
import { Gramola } from './components/gramola/gramola';
import { CallbackComponent } from './components/callback/callback.component';
import { PagosComponent } from './components/pagos/pagos.component';
import { RecuperarPasswordComponent } from './components/recuperar-password/recuperar-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
// IMPORTANTE:
import { PasarelaPagoComponent } from './components/pasarela-pago/pasarela-pago.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: Registro },
  { path: 'gramola', component: Gramola },
  { path: 'callback', component: CallbackComponent },
  { path: 'pagos', component: PagosComponent },
  { path: 'recuperar-password', component: RecuperarPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  // NUEVA RUTA
  { path: 'pasarela', component: PasarelaPagoComponent }
];