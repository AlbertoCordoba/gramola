import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { Registro } from './components/registro/registro';
import { Gramola } from './components/gramola/gramola';
import { PagosComponent } from './components/pagos/pagos.component';
import { PasarelaPagoComponent } from './components/pasarela-pago/pasarela-pago.component';
import { SeleccionPlaylistComponent } from './components/seleccion-playlist/seleccion-playlist.component'; // IMPORTAR

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: Registro },
  { path: 'config-audio', component: SeleccionPlaylistComponent }, // NUEVA RUTA
  { path: 'gramola', component: Gramola },
  { path: 'pagos', component: PagosComponent },
  { path: 'pasarela', component: PasarelaPagoComponent }
];