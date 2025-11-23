import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { Registro } from './components/registro/registro';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' }, // Si no pone nada, ir al login
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: Registro }
];