import {Component, OnInit} from '@angular/core';
import {UserService} from "./shared/services/user.service";

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{
    title = 'competence-tree';

    constructor(private userService: UserService) {
    }

    ngOnInit() {
        this.userService.loadUserData();
    }
}
