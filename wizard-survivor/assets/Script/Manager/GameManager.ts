import InputManager from "./InputManager";
import PoolManager from "./PoolManager";
import PlayerManager from "./PlayerManager";
import {AttrNum} from "../Helper/Attributes";

const {ccclass, property} = cc._decorator;

/*
1. 創建場景：遊戲物件、UI 等
2. 提供 Manager 的入口
3. 統計全局遊戲數據：EXP、等級、殺敵數、金幣數等
4. 提供全局事件
 */
@ccclass
export default class GameManager extends cc.Component {
    public event: cc.EventTarget;
    public static readonly GAME_STAT_CHANGE: string = "GAME_STAT_CHANGE";
    public static readonly GAME_START: string = "GAME_START";
    public static readonly LEVEL_UP: string = "LEVEL_UP";

    public static get instance(): GameManager {
        if (!GameManager._instance) {
            GameManager._instance = cc.find('Game').getComponent(GameManager);
        }
        return GameManager._instance;
    }

    public get inputManager(): InputManager {
        return this._inputManager
    };

    public get poolManager(): PoolManager {
        return this._poolManager;
    }

    public get playerManager(): PlayerManager {
        return this._playerManager;
    }

    public killEnemyCnt: AttrNum = new AttrNum(0);
    public coinCnt: AttrNum = new AttrNum(0);
    public upgradeExp: AttrNum = new AttrNum(100);
    public level: AttrNum = new AttrNum(1);
    public exp: AttrNum = new AttrNum(0);

    /*每升一等，升等需要的經驗會增加多少百分比*/
    private readonly UPGRADE_EXP_GROWTH: number = 20;

    private static _instance: GameManager = null;
    private _inputManager: InputManager;
    private _poolManager: PoolManager;
    private _playerManager: PlayerManager;


    // CC-CALLBACKS
    onLoad() {
        cc.director.getPhysicsManager().enabled = true;
        cc.director.getCollisionManager().enabled = true;
        cc.director.getCollisionManager().enabledDebugDraw = true;
        cc.game.addPersistRootNode(this.node);

        this._inputManager = this.node.addComponent(InputManager);
        this._poolManager = this.node.addComponent(PoolManager);
        this._playerManager = this.node.addComponent(PlayerManager);

        this.event = new cc.EventTarget();

        // 遊戲狀態改變事件
        const onGameStatCh = () => {this.event.emit(GameManager.GAME_STAT_CHANGE)};
        this.killEnemyCnt.onChangeCallback.push(onGameStatCh);
        this.coinCnt.onChangeCallback.push(onGameStatCh);
        this.exp.onChangeCallback.push(onGameStatCh);
        this.level.onChangeCallback.push(onGameStatCh);
        this.upgradeExp.onChangeCallback.push(onGameStatCh);

        this.inputManager.event.on(cc.SystemEvent.EventType.KEY_DOWN, ({keyCode})=>{
            if (keyCode === cc.macro.KEY.u){
                this.exp.addFactor += 5;
            }
        })

        // 經驗值＆升等事件
        this.exp.onChangeCallback.push(()=> {
            while (this.exp.value >= this.upgradeExp.value) {
                this.exp.addFactor -= this.upgradeExp.value;
                this.level.addFactor += 1;
                this.upgradeExp.percentageFactor += this.UPGRADE_EXP_GROWTH;
            }
        });
        this.level.onChangeCallback.push(()=> this.event.emit(GameManager.LEVEL_UP));
    }

    start(){
        this.generateGameScene();
    }


    // HELPERS:
    private generateGameScene(){
        let ui, enemy, drop: cc.Node;
        cc.resources.load('Prefab/UI/FixedUI', cc.Prefab, (err, prefab) => {
            ui = cc.instantiate(prefab) as unknown as cc.Node;
            this.node.addChild(ui);
            console.log('ui', ui);
        });
        this._playerManager.createPlayer('owowo');
        cc.resources.load('Prefab/Enemy', cc.Prefab, (err, prefab) => {
            enemy = cc.instantiate(prefab) as unknown as cc.Node;
            this.node.addChild(enemy);
            enemy.position = cc.v3(100, 100, 0)
        })
        cc.resources.load('Prefab/DropTest', cc.Prefab, (err, prefab) => {
            drop = cc.instantiate(prefab) as unknown as cc.Node;
            this.node.addChild(drop);
            drop.position = cc.v3(200, 200, 0);
        })
        this.event.emit(GameManager.GAME_START)
    }
}
