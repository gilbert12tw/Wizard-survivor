import {AttrNum, ProjectileAttr} from "../Helper/Attributes";
import PlayerController from "./PlayerController";
import ProjectileController from "./ProjectileController";
import GameManager from "../Manager/GameManager";
import requireComponent = cc._decorator.requireComponent;
import {ignoreZ, padZ} from "../Helper/utils";
import SearchEnemy from "../Helper/SearchEnemy";
import {ISearchTarget} from "../Helper/ISearchTarget";
import Game = cc.Game;

const {ccclass, property} = cc._decorator;

@ccclass
export default class WeaponController extends cc.Component {

    @property(AttrNum)
    public attackSpeed: AttrNum = new AttrNum();

    @property(AttrNum)
    public streamNum: AttrNum  = new AttrNum();

    @property(AttrNum)
    public streamSpeed: AttrNum = new AttrNum();

    @property({type: AttrNum, tooltip: "攻擊前搖時長"})
    public castTime: AttrNum = new AttrNum();

    @property(ProjectileAttr)
    public projectileAttr: ProjectileAttr = new ProjectileAttr();

    @property(AttrNum)
    public range: AttrNum = new AttrNum();

    @property(cc.Prefab)
    public projectilePrefab: cc.Prefab = null;

    public player: PlayerController = null;

    private canAttack: boolean = false;
    private attackCountDown: number = 0;
    private searchTarget: ISearchTarget = null;

    onLoad() {
        this.searchTarget = this.node.addComponent(SearchEnemy);
        this.range.onChangeCallback.push(() => {this.searchTarget.searchRange = this.range.value;});
    }

    public init(){
        this.canAttack = false;
        this.player.event.on(PlayerController.PLAYER_START_MOVE, this.stopAttack, this);
        this.player.event.on(PlayerController.PLAYER_STOP_MOVE, this.startAttack, this);
    }

    update(dt){
        this.attackCountDown -= dt;
        if (this.canAttack && this.attackCountDown <= 0){
            this.shoot();
            this.attackCountDown = 1/this.attackSpeed.value;
        }
    }

    private startAttack(){
        this.canAttack = true;
        this.attackCountDown = Math.max(this.attackCountDown, this.castTime.value);
    }

    private stopAttack(){
        this.canAttack = false;
    }

    private shoot() {
        const target = this.searchTarget.getTarget();
        console.log('Target: ', target);
        if (!target) return;
        const projectile = cc.instantiate(this.projectilePrefab).getComponent(ProjectileController);
        const pos =  GameManager.instance.canvas.convertToNodeSpaceAR(this.node.convertToWorldSpaceAR(cc.v2(0, 0)));
        projectile.node.setPosition(pos);
        projectile.init({...this.projectileAttr});
        projectile.node.parent = GameManager.instance.canvas;
        projectile.shootToDirection(ignoreZ(target.position.sub(this.player.node.position)).normalize());
    }
}
