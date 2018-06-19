import { Route } from '@angular/router';
import { EditRecordComponent } from './edit-record.component';
import { SSOAuthGuard } from '../../../shared/services/sso-auth.guard';

export const EditRecordRoutes: Route[] = [
    {
        path: 'data/projects/:projId/datasets/:datasetId/create-record',
        component: EditRecordComponent,
        canActivate: [SSOAuthGuard],
        canActivateChild: [SSOAuthGuard]
    },
    {
        path: 'data/projects/:projId/datasets/:datasetId/record/:recordId',
        component: EditRecordComponent,
        canActivate: [SSOAuthGuard],
        canActivateChild: [SSOAuthGuard]
    },
    {
        path: 'data/projects/:projId/datasets/:datasetId/create-child-record',
        component: EditRecordComponent,
        canActivate: [SSOAuthGuard],
        canActivateChild: [SSOAuthGuard]
    },
    {
        path: 'data/projects/:projId/datasets/:datasetId/child-record/:recordId',
        component: EditRecordComponent,
        canActivate: [SSOAuthGuard],
        canActivateChild: [SSOAuthGuard]
    }
];
