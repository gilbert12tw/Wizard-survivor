import EnemyController from "./EnemyController";
import {ProjectileAttr} from "./Attributes";
import requireComponent = cc._decorator.requireComponent;

const {ccclass, property} = cc._decorator;

@ccclass
@requireComponent(cc.RigidBody)
export default class ProjectileController extends cc.Component {

    private projectileAttr: ProjectileAttr = null;
    private rb: cc.RigidBody = null;
    private onHitCallback: Function = null;

    protected onLoad(){
        this.rb = this.getComponent(cc.RigidBody);
        this.rb.bullet = true;
    }

    public init(projectileAttr: ProjectileAttr, onHitCallback: Function = null){
        this.projectileAttr = projectileAttr;
        this.onHitCallback = onHitCallback;
    }

    protected onBeginContact(contact: cc.PhysicsContact, selfCollider: cc.PhysicsCollider, otherCollider: cc.PhysicsCollider){
        const enemy = otherCollider.getComponent(EnemyController);
        if (enemy){
            this.onHitCallback({enemy: enemy, projectile: this});
        }
    }

    public shootToDirection(direction: cc.Vec2){
        this.rb.linearVelocity = direction.mul(this.projectileAttr.flySpeed.value);
    }

}
