import { ILogger } from "nchat-dev-common"

interface IFetcherClient {
    collectDefaultMetrics(promClient: any): void;
    fetcherFactory(logger: ILogger): IFetcher;
}

interface IFetcher {
    fetch<T>(url: string, options: any): Promise<IFetchResponse<T>>;
}

interface IFetchResponse<T> {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Headers;
    text(): Promise<string>;
    json(): Promise<T>;
    buffer(): Promise<Buffer>;
}

export function collectDefaultMetrics(promClient: any): void;

export function fetcherFactory(logger: ILogger): IFetcher;
