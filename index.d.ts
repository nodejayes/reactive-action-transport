declare module 'logger' {
	import * as winston from 'winston';
	export const LOGGER: winston.Logger;

}
declare module 'server' {
	/// <reference types="node" />
	import * as WebSocket from 'ws';
	import { ServerOptions } from 'ws';
	import { Chars, EventHandler, List } from 'ts-tooling';
	import { IncomingMessage } from 'http';
	import { IWebSocketAction } from 'reactive-action-transport-data';
	export class ServerSocket {
	    Id: Chars;
	    Socket: WebSocket;
	    constructor(s: WebSocket);
	}
	export interface IWebSocketContext<T> {
	    server: WebSocketServer<T>;
	    socket: ServerSocket;
	    context: T;
	}
	export type ActionMethod<T> = (payload: any, ctx: IWebSocketContext<T>) => void;
	export type ContextCreationMethod<T> = (socket: ServerSocket, req: IncomingMessage) => IWebSocketContext<T>;
	export type ConnectionValidation<T> = (socket: IWebSocketContext<T>, req: IncomingMessage) => boolean;
	export type MessageValidation<T> = (socket: IWebSocketContext<T>, action: IWebSocketAction<any>) => boolean;
	export class WebSocketServer<T> {
	    constructor(options: ServerOptions);
	    private _server;
	    private _options;
	    private _connectedSockets;
	    private _actions;
	    OnConnect: EventHandler<WebSocketServer<T>, IWebSocketContext<T>>;
	    OnSocketError: EventHandler<WebSocketServer<T>, {
	        target: IWebSocketContext<T>;
	        error: Error;
	    }>;
	    OnSocketClose: EventHandler<WebSocketServer<T>, {
	        target: IWebSocketContext<T>;
	        code: number;
	        reason: string;
	    }>;
	    CreateContext: ContextCreationMethod<T>;
	    ValidateConnection: ConnectionValidation<T>;
	    ValidateMessage: MessageValidation<T>;
	    Start(): void;
	    Stop(): void;
	    GetSocketById(id: Chars): IWebSocketContext<T>;
	    GetSocketsByFilter(filter: () => boolean): List<IWebSocketContext<T>>;
	    RegisterAction(type: Chars, cb: ActionMethod<T>): void;
	    SendToSocket(socket: List<IWebSocketContext<T>> | IWebSocketContext<T>, data: IWebSocketAction<any>): void;
	    private createContext;
	    private validateAndConnect;
	    private onMessageReceive;
	    private onServerError;
	    private onSocketError;
	    private onSocketClose;
	}

}
declare module 'reactive-action-transport' {
	export * from 'server';

}
