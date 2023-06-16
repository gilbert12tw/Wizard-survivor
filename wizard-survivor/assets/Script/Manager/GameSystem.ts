import {Input} from "./InputManager";
import GameManager from "./GameManager";
import Echo from "laravel-echo";
import {GameInfo, GameStartType, GameType} from "../UI/MainMenuUI";
import {api, CURRENT_ENV} from "../Helper/utils";

/*
1. 負責轉發需要和其他客戶端、伺服器同步的事件。
 */

export type GameRecord = {
    level: number,
    personal_coin: number
}

export class GameSystem {

    // === Define Events ===
    public event: cc.EventTarget;

    /* 事件：玩家獲得 Buff

    passed event data: {uid: string, buffId: string} */
    public static readonly ON_BUFF_APPLY: string = "ON_BUFF_ADD";

    /*事件：玩家 HP 改變

    passed event data: {uid: string, deltaHP: number}
     */
    public static readonly ON_PLAYER_HP_CHANGE: string = "ON_PLAYER_HP_CHANGE";

    /*事件：玩家經驗值改變

    passed event data: {deltaExp: number} */
    public static readonly ON_EXP_CHANGE: string = "ON_EXP_CHANGE";

    /*事件：玩家金幣改變

    passed event data: {deltaCoin: number} */
    public static readonly ON_COIN_CHANGE: string = "ON_COIN_CHANGE";

    /*事件：玩家輸入

    passed event data: {input: Input} */
    public static readonly ON_INPUT: string = "ON_INPUT";

    /*事件：玩家創建

    注意！！！這個事件會廣播給所有 client，但是只有 remote client 需要處理這個事件

    passed event data: {uid: string, charaId: string, isLocal: boolean}
     */
    public static readonly ON_CREATE_PLAYER: string = "ON_CREATE_PLAYER";

    /*事件：遊戲開始

    passed event data: null
     */
    public static readonly ON_GAME_START: string = "ON_GAME_START";

    /*事件：遊戲結束

    passed event data: null
     */
    public static readonly ON_GAME_END: string = "ON_GAME_END";

    private buffReadyToApply: { uid: string, buffId: string }[] = [];

    constructor() {
        this.event = new cc.EventTarget();
    }


    // === PUBLIC METHODS ===
    public emitApplyBuff(uid: string, buffId: string): void {
        this.buffReadyToApply.push({uid: uid, buffId: buffId});

        // TODO: GameSystem should not know how many players there are
        if (this.buffReadyToApply.length >= GameManager.instance.playerManager.allPlayerIDs.length) {
            for (let bf of this.buffReadyToApply) {
                this.event.emit(GameSystem.ON_BUFF_APPLY, bf);
            }
            this.buffReadyToApply = [];
        }
    }

    public emitPlayerHPChange(uid: string, deltaHP: number): void {
        this.event.emit(GameSystem.ON_PLAYER_HP_CHANGE, {uid: uid, deltaHP: deltaHP});
    }

    public emitExpChange(deltaExp: number) {
        // emit exp change
        this.event.emit(GameSystem.ON_EXP_CHANGE, {deltaExp: deltaExp});
    }

    public emitCoinChange(deltaCoin: number) {
        // emit coin change
        this.event.emit(GameSystem.ON_COIN_CHANGE, {deltaCoin: deltaCoin});
    }

    public emitInput(input: Input) {
        this.event.emit(GameSystem.ON_INPUT, {input: input});
    }

    public emitCreatePlayer(uid: string, charaId: string) {
        this.event.emit(GameSystem.ON_CREATE_PLAYER, {uid: uid, charaId: charaId, isLocal: true});
    }

    public emitGameStart() {
        this.event.emit(GameSystem.ON_GAME_START);
    }

    public saveGameRecord(gameRecord: GameRecord){
        console.log('GameSystem.saveGameRecord; gameRecord', gameRecord);
    }

    //public emitCreatePlayer(uid: string, charaId: string){
    //      this event is broadcast to all client,
    //      but client handel this event only if it is from remote
    //      this.event.emit(GameSystem.ON_CREATE_PLAYER, {uid: uid, charaId: charaId});
}

export class RemoteGameSystem extends GameSystem {
    public echoInstance: Echo;
    private gameInfo: GameInfo;
    private mem_createPlayer: { uid: string, charaId: string }[] = [];

    private createEchoInstanceFromToken(token) {
        localStorage.setItem('token', token)
        this.echoInstance = new Echo({
            ...CURRENT_ENV.PUSHER_CONFIG,
            authorizer: (channel, options) => {
                return {
                    authorize: (socketId, callback) => {
                        api("POST", '/broadcasting/auth', {
                            socket_id: socketId,
                            channel_name: channel.name
                        }).then(response => {
                            callback(null, response);
                        }).catch(error => {
                            callback(error);
                        });
                    }
                };
            },
        });
    }

    constructor(gameInfo: GameInfo) {
        super();
        this.createEchoInstanceFromToken(localStorage.getItem('token'))
        this.gameInfo = gameInfo;

        // @ts-ignore
        this.echoInstance.join('room.' + this.gameInfo?.id).listenToAll((evt, data) => {
            console.log('receive event', evt, data)
            if (evt.startsWith('.client-')) {
                const evt_name =    evt.split('client-')[1];
                if(evt_name === "ON_CREATE_PLAYER"){
                    this.mem_createPlayer.push(data);
                }
                if(evt_name === "ON_GAME_START"){
                    this.dispatchCreatePlayers();
                }
                console.log('dispatch event', evt_name, data)
                this.event.emit(evt_name, data);
            }
        });
    }

    private dispatchEvent(evt, data) {
        this.event.emit(evt, data);
        this.echoInstance.join('room.' + this.gameInfo?.id).whisper(evt, data);
    }

    // === PUBLIC METHODS ===
    public emitApplyBuff(uid: string, buffId: string): void {
        // TODO
    }

    public emitPlayerHPChange(uid: string, deltaHP: number): void {
        this.dispatchEvent(GameSystem.ON_PLAYER_HP_CHANGE, {uid: uid, deltaHP: deltaHP});
    }

    public emitExpChange(deltaExp: number) {
        this.dispatchEvent(GameSystem.ON_EXP_CHANGE, {deltaExp: deltaExp});
    }

    public emitCoinChange(deltaCoin: number) {
        this.dispatchEvent(GameSystem.ON_COIN_CHANGE, {deltaCoin: deltaCoin});
    }

    public emitInput(input: Input) {
        this.dispatchEvent(GameSystem.ON_INPUT, {input: input});
    }

    public emitCreatePlayer(uid: string, charaId: string) {
        this.mem_createPlayer.push({uid: uid, charaId: charaId});
        this.dispatchEvent(GameSystem.ON_CREATE_PLAYER, {
            uid: uid,
            charaId: charaId
        });
    }

    private dispatchCreatePlayers(){
        if (this.gameInfo?.gameStartType === GameStartType.ONLINE_NEW_ROOM) {
            for (let p of this.mem_createPlayer) {
                this.dispatchEvent(GameSystem.ON_CREATE_PLAYER, {
                    uid: p.uid,
                    charaId: p.charaId
                });
            }
        }
    }

    public emitGameStart() {
        this.dispatchCreatePlayers();
        this.dispatchEvent(GameSystem.ON_GAME_START, {});
    }
}

/**
 * GameSystem Factory
 * @param gameInfo : GameInfo
 * @return GameSystem
 * */
export function createGameSystem(gameInfo: GameInfo): GameSystem {
    if (gameInfo.gameType === GameType.OFFLINE)
        return new GameSystem();
    else if (gameInfo.gameType === GameType.ONLINE) {
        // @ts-ignore
        window.Pusher = require('pusher-js');
        return new RemoteGameSystem(gameInfo);
    } else
        throw new Error("GameType not supported");
}
