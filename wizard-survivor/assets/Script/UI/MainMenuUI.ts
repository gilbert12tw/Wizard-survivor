import PlayerFocus from "./PlayerFocus";
import GameManager from "../Manager/GameManager";
import {api} from "../Helper/utils";

const {ccclass, property} = cc._decorator;

/*
給定 uid，
使得該 uid 可以根據事先註冊好的 input 事件來操作 MainMenuUI：
1. 登入
2. 創建房間
3. 加入房間
並回傳 uid
 */

export enum GameType {
    ONLINE,
    OFFLINE
}

export enum GameStartType {
    OFFLINE_1P,
    OFFLINE_2P,
    OFFLINE_3P,
    ONLINE_NEW_ROOM,
    ONLINE_JOIN_ROOM
}

export type GameInfo = {
    code?: string;
    localUids: string[];
    id?: string | number;
    users?: {
        id: string | number;
        name: string;
        email: string;
    }[];
    gameStartType?: GameStartType;
    gameType?: GameType;
}

@ccclass
export default class MainMenuUI extends cc.Component {
    /*
    事件：當玩家選擇好遊戲模式後（線上、離線...）

    callbackFn: ({gameInfo: GameInfo}) => void
     */
    public static readonly ON_AUTH_COMPLETED: string = "ON_START_GAME_INFO_PREPARED";
    public static readonly ON_LEADERBOARD_CLICKED: string = "ON_LEADERBOARD_CLICKED";
    public event: cc.EventTarget;

    private readonly child: string[] = ['OnlineWithNewRoom', 'OnlineJoinRoom', 'Offline1p', 'Offline2p', 'Offline3p'];
    private uid: string;

    private playerFocus: PlayerFocus;
    private roomType = 0;

    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        this.playerFocus = this.node.getComponent(PlayerFocus);
        this.event = new cc.EventTarget();
    }

    public init(performerUid: string) {
        this.uid = performerUid;

        const focusTarget = [];
        for (let i = 0; i < this.child.length; i++) {
            focusTarget.push(this.node.getChildByName(this.child[i]));
        }

        this.playerFocus.init(focusTarget, cc.v2(0, 60), true);
        this.playerFocus.focusOnIndex(this.uid, 0);

        this.node.getChildByName("AuthDialog").getChildByName('AuthButton').on(cc.Node.EventType.TOUCH_END, this.auth.bind(this), this);
        this.node.getChildByName("RoomDialog").getChildByName('JoinButton').on(cc.Node.EventType.TOUCH_END, this.join.bind(this), this);
        this.playerFocus.event.on(PlayerFocus.ON_CONFIRM, this.onConfirm, this);
    }

    /*
     */
    // public async getStartGameInfo(): Promise<GameInfo> {
    //     // let res: GameInfo = {
    //     //     localUids: ['p1', 'p2']
    //     // }
    //     // return res;
    //     return new Promise((resolve, reject) => {
    //         setTimeout(() => {
    //             resolve({
    //                 localUids: ['p1', 'p2']
    //             })
    //         }, 500000)
    //     })
    // }


    // HELPERS:
    private onConfirm({uid, node}) {
        const execute = {};
        execute['OnlineWithNewRoom'] = this.onlineWithNewRoom.bind(this);
        execute['OnlineJoinRoom'] = this.onlineJoinRoomId.bind(this);
        execute['Offline1p'] = this.offline1p.bind(this);
        execute['Offline2p'] = this.offline2p.bind(this);
        execute['Offline3p'] = this.offline3p.bind(this);

        execute[node.name]();
    }

    private offline1p(): void {
        const gameInfo: GameInfo = {
            gameType: GameType.OFFLINE,
            localUids: ['p1'],
            gameStartType: GameStartType.OFFLINE_1P
        }
        this.event.emit(MainMenuUI.ON_AUTH_COMPLETED, {gameInfo: gameInfo})
    }

    private offline2p(): void {
        const gameInfo: GameInfo = {
            gameType: GameType.OFFLINE,
            localUids: ['p1', 'p2'],
            gameStartType: GameStartType.OFFLINE_2P
        }
        this.event.emit(MainMenuUI.ON_AUTH_COMPLETED, {gameInfo: gameInfo})
    }

    private offline3p(): void {
        const gameInfo: GameInfo = {
            gameType: GameType.OFFLINE,
            localUids: ['p1', 'p2', 'p3'],
            gameStartType: GameStartType.OFFLINE_3P
        }
        this.event.emit(MainMenuUI.ON_AUTH_COMPLETED, {gameInfo: gameInfo})
    }

    private async auth() {
        let email = this.node.getChildByName("AuthDialog").getChildByName('Email').getComponent(cc.EditBox).string;
        if (email.indexOf('@') === -1) {
            email += '@gmail.com';
        }
        const password = this.node.getChildByName("AuthDialog").getChildByName('Password').getComponent(cc.EditBox).string;
        const res = await api("POST", "/sanctum/token", {
            email,
            password
        })

        if (typeof res.message !== "undefined") {
            if (res.message !== "Unauthenticated.")
                alert(`錯誤：${res.message}`);
            return;
        }

        const {token, user} = res;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));

        if (this.roomType) {
            this.node.getChildByName("AuthDialog").active = false;
            this.node.getChildByName("RoomDialog").active = true;
        } else {
            await this.getRoom();
        }
    }

    private async join() {
        const code = this.node.getChildByName("RoomDialog").getChildByName('Code').getComponent(cc.EditBox).string;
        await this.getRoom(code);
    }

    private async getRoom(code?) {
        let room;
        if (this.roomType) {
            room = await api("POST", "/rooms/add", {code})
        } else {
            room = await api("GET", "/rooms")
        }
        if (typeof room.message !== "undefined") {
            if (room.message !== "Unauthenticated.")
                alert(`錯誤：${room.message}`);
            return;
        }
        const userId = room.user_id
        room = room.room;
        //if (typeof code === "undefined")
        //alert(room.code)

        const gameInfo: GameInfo = {
            gameType: GameType.ONLINE,
            localUids: [userId],
            ...room,
            gameStartType: typeof code === "undefined" ? GameStartType.ONLINE_NEW_ROOM : GameStartType.ONLINE_JOIN_ROOM
        }
        this.event.emit(MainMenuUI.ON_AUTH_COMPLETED, {gameInfo})
    }

    private async onlineWithNewRoom(): Promise<GameInfo> {
        this.roomType = 0;
        if (localStorage.getItem("token") === null)
            this.node.getChildByName('AuthDialog').active = true;
        await this.getRoom()
        return null;
    }

    private async onlineJoinRoomId(): Promise<GameInfo> {
        this.roomType = 1;
        if (localStorage.getItem("token") === null)
            this.node.getChildByName('AuthDialog').active = true;
        this.node.getChildByName("RoomDialog").active = true;
        return null;
    }

    public async getUserData() {
        return await api("GET", `/my`)
    }

    private async leaderboard() {
        this.event.emit(MainMenuUI.ON_LEADERBOARD_CLICKED)
    }
}
