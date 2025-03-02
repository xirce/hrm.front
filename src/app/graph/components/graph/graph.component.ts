import {Component, OnDestroy, OnInit} from '@angular/core';
import {ECharts, EChartsOption} from "echarts";
import {LinksService} from 'src/app/shared/services/links.service';
import {NodesService} from "../../../shared/services/nodes.service";
import {IFilters, NodeTypes, INodeInfo, INode} from "../../../shared/interfaces";
import {forkJoin} from "rxjs";
import {NodeInfoService} from "../../../shared/services/node-info.service";
import {UserService} from "../../../shared/services/user.service";
import {IUser} from "../../../shared/interfaces/IUser";

@Component({
    selector: 'app-graph',
    templateUrl: './graph.component.html',
    styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements OnInit, OnDestroy {
    user: IUser;
    nodeInfo: INodeInfo;
    echartsInstance: ECharts;
    sidebar = false;
    modal = false;
    options: EChartsOption;
    selectedNode: INode = {
        type: 'main',
        id: '',
        name: '',
        parentId: null
    };

    constructor(
        private nodesService: NodesService,
        private linksService: LinksService,
        private nodeInfoService: NodeInfoService,
        private userService: UserService
    ) {
    }

    ngOnInit() {
        this.user = this.userService.getUser();
        if (this.user) {
            this.userService.loadUserSkills();
        }
        this.nodesService.getAllRoles().subscribe(roles => {
            this.nodesService.addNewNodes(roles);
            this.linksService.bindRolesWithMainNode();
            this.options = {
                tooltip: {
                    formatter: '{b}'
                },
                darkMode: true,
                series: [{
                    animationEasingUpdate: 'quarticOut',
                    type: 'graph',
                    roam: true,
                    layout: 'force',
                    force: {
                        gravity: 0.05,
                        repulsion: 60,
                        edgeLength: 20
                    },
                    zoom: 5,
                    scaleLimit: {
                        min: 3,
                        max: 15
                    },
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: "bold",
                        formatter: (params) => {
                            return params.name.split(' ').join('\n')
                        }
                    },
                    lineStyle: {
                        width: 2
                    },
                    data: this.nodesService.getGraphNodes(),
                    links: this.linksService.getLinks()
                }]
            };
        });
    }

    markSkill() {
        this.userService.addSkillToUser(this.selectedNode).subscribe((skill) => {
            this.userService.pushSkill(skill);
            this.nodesService.changeSkillColor(skill.id);
            const skills = this.nodesService.findSkillByGradeId(skill.parentId);
            const marked = this.nodesService.findMarkedSkills(skills);

            if (marked.length === skills.length) {
                this.nodesService.changeGradeColor(skill.parentId);
            }
            this.setNewOptions();
            this.modal = false;
        });
    }

    showSidebar() {
        this.sidebar = true;
    }

    filterNodes(ev: IFilters) {
        const filters = Object.entries(ev)
            .filter(pair => pair[1])
            .map(pair => pair[0]);
        const filtered = this.nodesService.getFilteredNodes(filters as NodeTypes[]);

        this.echartsInstance.setOption({
            series: [{
                data: filtered,
                links: this.linksService.getLinks()
            }]
        });
    }

    onChartInit($event: ECharts) {
        this.echartsInstance = $event;
        this.echartsInstance.hideLoading();
    }

    onChartEvent(event: any) {
        if (event.dataType === 'node' && event.data.type !== 'main') {
            this.selectedNode = {...event.data};
            const nodeId = event.data.id;
            const id = nodeId.split(':')[1];
            if (this.nodesService.checkIsParent(nodeId)) return;

            switch (event.data.type) {
                case 'skill':
                    this.nodeInfoService.getDetailedSkill(id)
                        .subscribe(skills => {
                            this.nodeInfo = {
                                parentId: event.data.id,
                                parentName: event.data.name,
                                type: 'skill',
                                details: skills ? skills : []
                            }
                        });
                    this.modal = true;
                    break;
                case 'position':
                    this.nodeInfoService.getPositionDuties(id)
                        .subscribe(duties => {
                            this.nodeInfo = {
                                parentId: event.data.id,
                                parentName: event.data.name,
                                type: event.data.type,
                                details: duties ? duties : []
                            };
                        })
                    this.modal = true;
                    break;
                case 'role':
                    this.nodesService.getGradesByRole(id)
                        .subscribe(grades => {
                            this.nodesService.setIsParentNode(event.data.id);
                            this.nodesService.addNewNodes(grades);
                            this.linksService.bindGradesByRole(id);
                            this.setNewOptions();
                        })
                    break;
                case 'grade':
                    forkJoin([
                        this.nodesService.getPositionsByGrade(id),
                        this.nodesService.getSkillsByGrade(id)
                    ]).subscribe(result => {
                        this.nodesService.setIsParentNode(event.data.id);
                        result.forEach(nodes => {
                            if (nodes.length > 0) {
                                this.nodesService.addNewNodes(nodes);
                                this.linksService.bindEntityWithGrade(id, nodes[0].type);
                            }
                        })
                        if (this.user) {
                            const skills = this.nodesService.findSkillByGradeId(event.data.id);
                            const marked = this.nodesService.findMarkedSkills(skills);

                            if (marked.length === skills.length && marked.length !== 0) {
                                this.nodesService.changeGradeColor(event.data.id);
                            }
                        }
                        this.setNewOptions();
                    });
                    break;
            }
        }
    }

    setNewOptions() {
        this.echartsInstance.setOption({
            series: [{
                data: this.nodesService.getGraphNodes(),
                links: this.linksService.getLinks()
            }]
        });
    }

    ngOnDestroy() {
        this.nodesService.resetNodes();
    }
}
