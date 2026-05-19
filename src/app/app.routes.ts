import { Routes } from '@angular/router';
import { DashboardPageComponent } from './pages/dashboard.page';
import { IssueDetailsPageComponent } from './pages/issue-details.page';

export const appRoutes: Routes = [
  { path: '', component: DashboardPageComponent, title: 'RealWorldProblems Portal' },
  { path: 'issues/:number', component: IssueDetailsPageComponent, title: 'Issue Details' },
  { path: '**', redirectTo: '' }
];