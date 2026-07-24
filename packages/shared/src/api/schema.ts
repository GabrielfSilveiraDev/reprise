export interface paths {
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/next-up": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Próximo episódio não visto de cada série acompanhada, por atividade recente. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["NextUpItemDto"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/episodes/{id}/watch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Marca o episódio como visto (novo evento). Repetir = rewatch. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": null | components["schemas"]["MarkBody"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WatchStateDto"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        /** Remove a exibição mais recente do episódio (decrementa o rewatch). */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WatchStateDto"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/series/{id}/seasons/{seasonNumber}/watch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Marca todos os episódios ainda não vistos da temporada. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                    seasonNumber: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": null | components["schemas"]["MarkBody"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BulkMarkResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/series/{id}/watch-up-to": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Marca todos os episódios regulares até (temporada, episódio), ainda não vistos. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["MarkUpToBody"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BulkMarkResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/series": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista as séries acompanhadas com progresso derivado do log de eventos. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SeriesListItemDto"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/series/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detalhe da série: temporadas e episódios com contagem de exibições (trilha de rewatch). */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SeriesDetailDto"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        BulkMarkResult: {
            /** Format: int32 */
            marked: number;
        };
        EpisodeDto: {
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            seasonNumber: number;
            /** Format: int32 */
            episodeNumber: number;
            name: null | string;
            /** Format: int32 */
            runtimeSeconds: number | null;
            isSpecial: boolean;
            /** Format: int32 */
            watchCount: number;
            /** Format: date-time */
            lastWatchedAt: null | string;
        };
        EpisodeRefDto: {
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            seasonNumber: number;
            /** Format: int32 */
            episodeNumber: number;
            name: null | string;
        };
        MarkBody: {
            /** Format: date-time */
            watchedAt: null | string;
        };
        MarkUpToBody: {
            /** Format: int32 */
            seasonNumber: number;
            /** Format: int32 */
            episodeNumber: number;
            /** Format: date-time */
            watchedAt: null | string;
        };
        NextUpItemDto: {
            /** Format: int64 */
            seriesId: number;
            seriesName: string;
            posterPath: null | string;
            episode: components["schemas"]["EpisodeRefDto"];
            /** Format: date-time */
            lastActivityAt: null | string;
        };
        SeasonDto: {
            /** Format: int32 */
            seasonNumber: number;
            name: null | string;
            isSpecials: boolean;
            episodes: components["schemas"]["EpisodeDto"][];
        };
        SeriesDetailDto: {
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            tvdbId: number | null;
            name: string;
            originalName: null | string;
            overview: null | string;
            posterPath: null | string;
            status: string;
            /** Format: int32 */
            episodesTotal: number;
            /** Format: int32 */
            episodesWatched: number;
            /** Format: double */
            completionRatio: number;
            seasons: components["schemas"]["SeasonDto"][];
        };
        SeriesListItemDto: {
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            tvdbId: number | null;
            name: string;
            posterPath: null | string;
            status: string;
            /** Format: int32 */
            episodesTotal: number;
            /** Format: int32 */
            episodesWatched: number;
            /** Format: double */
            completionRatio: number;
            /** Format: date-time */
            lastWatchedAt: null | string;
            nextUp: null | components["schemas"]["EpisodeRefDto"];
        };
        WatchStateDto: {
            /** Format: int64 */
            episodeId: number;
            /** Format: int32 */
            watchCount: number;
            /** Format: date-time */
            lastWatchedAt: null | string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
