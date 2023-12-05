import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { BiosysCoreModule } from '../biosys-core/biosys-core.module';
import { APIService } from '../biosys-core/services/api.service';
import { AuthService } from '../biosys-core/services/auth.service';
import { ApiInterceptor } from '../biosys-core/services/api.interceptor';

import { SharedModule } from './shared/shared.module';

import { AppComponent } from './app.component';
import { routes } from './app.routes';

import { SSOAuthService } from './shared/services/sso-auth.service';
import { SSOAuthGuard } from './shared/guards/sso-auth.guard';

import { AccountsModule } from './pages/accounts/accounts.module';
import { HomeModule } from './pages/home/home.module';
import { DataManagementModule } from './pages/data-management/data-management.module';
import { AdministrationModule } from './pages/administration/administration.module';
import { DataViewExportModule } from './pages/data-view-export/data-view-export.module';
import { environment } from '../environments/environment';
import { AuthGuard } from './shared/guards/auth.guard';
import { AdminGuard } from './shared/guards/admin.guard';
import { DataEngineerGuard } from './shared/guards/data-engineer.guard';
import { TeamMemberGuard } from './shared/guards/team-member.guard';
import { AdminOnlyComponent } from './pages/accounts/admin-only/admin-only.component';

@NgModule({
    declarations: [
        AppComponent,
        AdminOnlyComponent
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        HttpClientModule,
        RouterModule.forRoot(routes, {}),
        ToastModule,
        BiosysCoreModule,
        SharedModule,
        AccountsModule,
        HomeModule,
        AdministrationModule,
        DataManagementModule,
        DataViewExportModule
    ],
    providers: [
        MessageService,
        APIService,
        {
            provide: AuthService,
            useClass: !!environment['useSSOAuth'] ? SSOAuthService : AuthService
        },
        {
            provide: AuthGuard,
            useClass: !!environment['useSSOAuth'] ? SSOAuthGuard : AuthGuard
        },
        AdminGuard,
        DataEngineerGuard,
        TeamMemberGuard,
        {
            provide: HTTP_INTERCEPTORS,
            useClass: ApiInterceptor,
            multi: true
        }
    ],
    bootstrap: [AppComponent]
})
export class AppModule {
}
