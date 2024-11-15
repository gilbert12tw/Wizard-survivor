import PlayerFocus from "./PlayerFocus";
import PlayerController from "../Controller/PlayerController";
import GameManager from "../Manager/GameManager";
import {GameStartType} from "./MainMenuUI";
import {RemoteGameSystem} from "../Manager/GameSystem";

const {ccclass, property} = cc._decorator;

@ccclass
export default class LobbyUI extends cc.Component {

    public event: cc.EventTarget;
    public static readonly ON_CHARA_CHOSEN: string = "onCharaChosen";

    private previewCharas: cc.Node[] = [];
    private playerFocus: PlayerFocus = null;
    private chooseResult: { [uid: string]: string } = {};
    private uids: string[] = [];
    private _coinLabel: cc.Label = null;
    private _remoteInfo: cc.Node = null;
    private _chooseCharaHint: cc.Node = null;

    // LIFE-CYCLE CALLBACKS:
    onLoad() {
        this.event = new cc.EventTarget();
        this.playerFocus = this.node.getComponent(PlayerFocus);
        this._coinLabel =
            this.node.getChildByName('Coin')
            .getChildByName('Label')
            .getComponent(cc.Label);
        this._remoteInfo = this.node.getChildByName('RemoteInfo');
        this._chooseCharaHint = this.node.getChildByName('ChooseCharaHint');
        this._chooseCharaHint.opacity = 255;
    }


    // PUBLIC METHODS:
    public async init(uids: string[]) {
        this.uids = [...uids];
        for (let chara of this.node.children) {
            if (chara.getComponent(PlayerController)) {
                this.previewCharas.push(chara);
            }
        }
        let record = await GameManager.instance.gameSystem.getGameRecord();
        this._coinLabel.string = record.coin.toString();

        if (GameManager.instance.gameSystem instanceof RemoteGameSystem) {
            this._remoteInfo.opacity = 255;
            const roomId = GameManager.instance.gameSystem.gameInfo.code;
            const username = JSON.parse(localStorage.getItem('user') ?? '{}')?.email.split('@')[0];
            this._remoteInfo.getChildByName('RoomId').getComponent(cc.Label).string = roomId.toString();
            this._remoteInfo.getChildByName('Username').getComponent(cc.Label).string = username;
        }
        else{
            this._remoteInfo.opacity = 0;
        }
    }

    public chooseCharaFor(): Promise<void> {
        if (!this.uids || this.uids.length == 0) {
            return Promise.reject("No uid to choose");
        }

        this.playerFocus.init(this.previewCharas, cc.v2(0, 20), true);

        for (let uid of this.uids) {
            this.playerFocus.focusOnIndex(uid, 0);
        }

        let chooseResult = {};

        return new Promise(resolve => {
            this.playerFocus.event.on(PlayerFocus.ON_CONFIRM, ({uid, node}) => {
                for (let res of Object.values(chooseResult)) {
                    if (res == node.name)
                        return;
                }

                this.playerFocus.lock(uid);
                chooseResult[uid] = node.name;

                if (Object.keys(chooseResult).length == this.uids.length) {
                    this.playerFocus.removeFocusAll();
                    this.chooseResult = chooseResult;
                    this._chooseCharaHint.opacity = 0;
                    resolve();
                }
            })
        });
    }

    public async createCharaFromChooseResult() {
        let promises = [];
        for (let uid of this.uids) {
            GameManager.instance.gameSystem.emitCreatePlayer(uid, this.chooseResult[uid]);
            promises.push(
                GameManager.instance.playerManager.instantiatePlayer(uid)
                    .then((player) => {
                        for (let chara of this.previewCharas) {
                            if (chara.name == this.chooseResult[uid]) {
                                player.node.position = chara.position;
                                chara.destroy();
                                break;
                            }
                        }
                    })
            );
        }
        await Promise.all(promises);
    }
}