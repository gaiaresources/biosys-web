import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../../../biosys-core/services/auth.service';
import { map, mergeMap } from 'rxjs/operators';
import { Project, Program, User } from '../../../biosys-core/interfaces/api.interfaces';
import { forkJoin, Observable } from 'rxjs';
import { APIService } from '../../../biosys-core/services/api.service';


@Injectable()
export class TeamMemberGuard  {
    constructor(private authService: AuthService, private apiService: APIService) {
    }

    canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
        const projId = +route.params['projId'];

        const projectProgramObservable: Observable<[Project, Program]> = this.apiService.getProjectById(projId).pipe(
            mergeMap((project: Project) => this.apiService.getProgramById(project.program).pipe(
                map((program: Program) => [project, program] as [Project, Program])
                )
            )
        );

        return forkJoin([projectProgramObservable, this.authService.getCurrentUser()]).pipe(
            map((result: [[Project, Program], User]) => {
                const project: Project = result[0][0];
                const program: Program = result[0][1];
                const user: User = result[1];

                if (user.is_admin) {
                    return true;
                } else if (user.is_data_engineer && program.data_engineers.indexOf(user.id) > -1) {
                    return true;
                } else {
                    return project.custodians.indexOf(user.id) > -1;
                }
            })
        );
    }
}
