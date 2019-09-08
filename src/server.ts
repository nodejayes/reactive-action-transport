import * as WebSocket from 'ws';
import {Server, ServerOptions} from 'ws';
import {Chars, Dictionary, EventHandler, List, LZCompression} from 'ts-tooling';
import {IncomingMessage} from 'http';
import * as uuidv4 from 'uuid/v4';
import {LOGGER} from "./logger";
import {IWebSocketAction} from 'reactive-action-transport-data';
import {DispatchType} from "dispatch-type";

export class ServerSocket {
    Id: Chars;
    Socket: WebSocket;

    constructor(s: WebSocket) {
        this.Id = new Chars(uuidv4());
        this.Socket = s;
    }
}

export interface IWebSocketContext<T> {
    server: WebSocketServer<T>,
    socket: ServerSocket,
    context: T,
}

export type ActionMethod<T> = (payload: any, ctx: IWebSocketContext<T>) => void;
export type ContextCreationMethod<T> = (socket: ServerSocket, req: IncomingMessage) => IWebSocketContext<T>;
export type ConnectionValidation<T> = (socket: IWebSocketContext<T>, req: IncomingMessage) => boolean;
export type MessageValidation<T> = (socket: IWebSocketContext<T>, action: IWebSocketAction<any>) => boolean;

export class WebSocketServer<T> {
    constructor(options: ServerOptions) {
        this._options = options;
    }

    private _server: Server = null;
    private _options: ServerOptions = null;
    private _connectedSockets = new Dictionary<IWebSocketContext<T>>();
    private _actions = new Dictionary<ActionMethod<T>>();

    public OnConnect = new EventHandler<WebSocketServer<T>, IWebSocketContext<T>>(this);
    public OnSocketError = new EventHandler<WebSocketServer<T>, {target: IWebSocketContext<T>, error: Error}>(this);
    public OnSocketClose = new EventHandler<WebSocketServer<T>, {target: IWebSocketContext<T>, code: number, reason: string}>(this);

    public CreateContext: ContextCreationMethod<T> = null;
    public ValidateConnection: ConnectionValidation<T> = null;
    public ValidateMessage: MessageValidation<T> = null;

    public Start(): void {
        this._server = new Server(this._options);
        this._server.on('connection', this.validateAndConnect.bind(this));
        this._server.on('error', this.onServerError);
        LOGGER.info('server started');
    }

    public Stop(): void {
        for (const key in this._connectedSockets.GetObject()) {
            this._connectedSockets.TryGetValue(key.ToChars()).socket.Socket.close(10000);
        }
        this._server.close();
        this._server = null;
        this._connectedSockets = new Dictionary({});
        LOGGER.info('server stopped');
    }

    public GetSocketById(id: Chars): IWebSocketContext<T> {
        return this._connectedSockets.TryGetValue(id) || null;
    }

    public GetSocketsByFilter(filter: () => boolean): List<IWebSocketContext<T>> {
        return this._connectedSockets.FindAll(filter);
    }

    public RegisterAction(type: Chars, cb: ActionMethod<T>): void {
        this._actions.Add(type, cb);
    }

    public SendToSocket(socket: List<IWebSocketContext<T>> | IWebSocketContext<T>, data: IWebSocketAction<any>): void {
        if (data.dispatchOn !== DispatchType.CLIENT && data.dispatchOn !== DispatchType.BOTH) {
            LOGGER.warning(`action ${data.type} is not a Client Action nothing send!`);
            return;
        }
        LOGGER.info('send data to socket');
        LOGGER.debug(data);
        if ((<any>socket).Count > 0) {
            const r = LZCompression.Compress(data);
            for (const ctx of (socket as List<IWebSocketContext<T>>).ToArray()) {
                ctx.socket.Socket.send(r);
            }
        } else if (socket) {
            (socket as IWebSocketContext<T>).socket.Socket.send(LZCompression.Compress(data).Value);
        }
        LOGGER.debug('data sended...');
    }

    private createContext(socket: ServerSocket, req: IncomingMessage): IWebSocketContext<T> {
        if (this.CreateContext) {
            return this.CreateContext(socket, req);
        }
        return {
            server: this,
            socket: socket,
            context: null,
        };
    }

    private validateAndConnect(socket: WebSocket, req: IncomingMessage): void {
        LOGGER.info('validate new connection');
        const s = new ServerSocket(socket);
        const ctx = this.createContext(s, req);
        if (this.ValidateConnection && !this.ValidateConnection(ctx, req)) {
            LOGGER.warning(`invalid connection from ${req.socket.address()}`);
            return;
        }
        ctx.socket.Socket.on('message', (data) => this.onMessageReceive(data, ctx));
        ctx.socket.Socket.on('error', (err) => this.onSocketError(err, ctx));
        ctx.socket.Socket.on('close', (code, reason) => this.onSocketClose(code, reason, ctx));
        this._connectedSockets.Add(ctx.socket.Id, ctx);
        if (this.OnConnect) {
            this.OnConnect.Invoke(ctx);
        }
    }

    private onMessageReceive(data: WebSocket.Data, ctx: IWebSocketContext<T>): void {
        const msg = (LZCompression.Decompress(new Chars(data.toString())) as IWebSocketAction<any>);
        if (!msg.type || (this.ValidateMessage && !this.ValidateMessage(ctx, msg))) {
            LOGGER.warning('invalid message send:');
            LOGGER.warning(msg);
            return;
        }
        if (msg.dispatchOn !== DispatchType.SERVER && msg.dispatchOn !== DispatchType.BOTH) {
            LOGGER.warning(`no server action ${msg.type} nothing happen!`);
            return;
        }
        const action = this._actions.TryGetValue(msg.type.ToChars());
        if (!action) {
            LOGGER.warning(`action ${msg.type} not found nothing happen!`);
            return;
        }
        action(msg.payload, ctx);
    }

    private onServerError(err: Error): void {
        LOGGER.error(err);
    }

    private onSocketError(err: Error, ctx: IWebSocketContext<T>): void {
        LOGGER.error(err);
        if (this.OnSocketError) {
            this.OnSocketError.Invoke({
                target: ctx,
                error: err,
            });
        }
    }

    private onSocketClose(code: number, reason: string, ctx: IWebSocketContext<T>): void {
        LOGGER.info(`socket close with code ${code} => ${reason}`);
        this._connectedSockets.Remove(ctx.socket.Id);
        if (this.OnSocketClose) {
            this.OnSocketClose.Invoke({
                target: ctx,
                reason,
                code,
            });
        }
    }
}
