/* Gerado por scripts/sync-api.mjs a partir de openapi.json — não edite à mão. */

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
    "/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cria a conta e envia o código de validação. Não devolve sessão. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RegisterBody"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RegistrationDto"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["HttpValidationProblemDetails"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": string;
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
    "/auth/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Valida a conta com o código de seis dígitos e já devolve a sessão. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ConfirmBody"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SessionDto"];
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
    "/auth/resend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reenvia o código. Responde igual em todos os casos, de propósito. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ResendBody"];
                };
            };
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Autentica por e-mail ou nome de usuário e devolve o par de tokens. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["LoginBody"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SessionDto"];
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
    "/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Troca o refresh token por um par novo. O antigo é consumido. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RefreshBody"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SessionDto"];
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
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Encerra a sessão. Idempotente: sair duas vezes não é erro. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RefreshBody"];
                };
            };
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
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
        /** Adiciona uma série do TMDB ao acervo e passa a acompanhá-la. Repetir não duplica. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AddSeriesBody"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AddSeriesResultDto"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": string;
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
    "/series/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Busca séries no TMDB para adicionar ao acervo. Marca as que você já tem. */
        get: {
            parameters: {
                query?: {
                    q?: string;
                };
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
                        "application/json": components["schemas"]["SeriesSearchResultDto"][];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": string;
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
    "/series/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Muda o estado da série: Following, Archived, ForLater ou Finished. */
        patch: {
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
                    "application/json": components["schemas"]["StatusBody"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TrackingUpdateResult"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/series/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Muda o estado de várias séries de uma vez. Definir um valor é idempotente. */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["TrackingChange"][];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TrackingUpdateResult"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/series/{id}/rewatch/dismissal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Tira a revisão da série da fila de próximos, até a próxima exibição repetida. */
        put: {
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
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
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
        post?: never;
        /** Devolve a revisão da série à fila de próximos. */
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
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
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
    "/next-up": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** O que assistir agora: o próximo inédito das acompanhadas e o próximo das revisões em andamento. */
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
                query?: {
                    clientKey?: string;
                };
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
    "/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Perfil do dono dos dados e o tamanho do acervo dele. */
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
                        "application/json": components["schemas"]["ProfileDto"];
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
    "/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Export completo e reconstruível: perfil, séries e todas as exibições. */
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
                        "application/json": components["schemas"]["ExportDocument"];
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
    "/premieres": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Episódios ainda por estrear das séries acompanhadas, do mais próximo ao mais distante. Sem withinDays, sem limite de distância. */
        get: {
            parameters: {
                query?: {
                    withinDays?: number;
                };
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
                        "application/json": components["schemas"]["PremiereDto"][];
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
    "/stats/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resumo, distribuição por ano/mês, top séries e sequências. Backfill fora por padrão. */
        get: {
            parameters: {
                query?: {
                    includeBackfill?: boolean;
                };
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
                        "application/json": components["schemas"]["StatsOverviewDto"];
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
    "/stats/calendar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Exibições por dia de um ano, para o heatmap. Só dias com atividade. */
        get: {
            parameters: {
                query: {
                    year: number;
                    includeBackfill?: boolean;
                };
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
                        "application/json": components["schemas"]["CalendarDayDto"][];
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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AddSeriesBody: {
            /** Format: int32 */
            tmdbId: number;
        };
        AddSeriesResultDto: {
            /** Format: int64 */
            seriesId: number;
            name: string;
            alreadyTracked: boolean;
            /** Format: int32 */
            episodesCreated: number;
        };
        BulkMarkResult: {
            /** Format: int32 */
            marked: number;
        };
        CalendarDayDto: {
            /** Format: date */
            date: string;
            /** Format: int32 */
            exhibitions: number;
            /** Format: int64 */
            seconds: number;
        };
        ConfirmBody: {
            email: string;
            code: string;
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
            runtimeSeconds: null | number;
            isSpecial: boolean;
            /** Format: int32 */
            watchCount: number;
            /** Format: date-time */
            lastWatchedAt: null | string;
            stillPath: null | string;
            overview: null | string;
            /** Format: date */
            airDate: null | string;
            /** Format: date-time */
            releasesAt: null | string;
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
        ExportDocument: {
            format: string;
            /** Format: date-time */
            exportedAt: string;
            profile: components["schemas"]["ExportedProfile"];
            series: components["schemas"]["ExportedSeries"][];
            watchEvents: components["schemas"]["ExportedWatchEvent"][];
        };
        ExportedProfile: {
            displayName: string;
            email: string;
            /** Format: date-time */
            memberSince: string;
        };
        ExportedSeries: {
            /** Format: int32 */
            tvdbId: null | number;
            /** Format: int32 */
            tmdbId: null | number;
            name: string;
            originalName: null | string;
            status: string;
            productionStatus: null | string;
            /** Format: date-time */
            addedAt: string;
        };
        ExportedWatchEvent: {
            /** Format: int32 */
            seriesTvdbId: null | number;
            seriesName: string;
            /** Format: int32 */
            seasonNumber: number;
            /** Format: int32 */
            episodeNumber: number;
            episodeName: null | string;
            /** Format: date-time */
            watchedAt: string;
            source: string;
            isBackfill: boolean;
            sourceKey: null | string;
        };
        HttpValidationProblemDetails: {
            type?: null | string;
            title?: null | string;
            /** Format: int32 */
            status?: null | number;
            detail?: null | string;
            instance?: null | string;
            errors?: {
                [key: string]: string[];
            };
        };
        LoginBody: {
            identifier: string;
            password: string;
        };
        MarkBody: {
            /** Format: date-time */
            watchedAt: null | string;
            clientKey: null | string;
        };
        MarkUpToBody: {
            /** Format: int32 */
            seasonNumber: number;
            /** Format: int32 */
            episodeNumber: number;
            /** Format: date-time */
            watchedAt: null | string;
            clientKey: null | string;
        };
        NextUpItemDto: {
            /** Format: int64 */
            seriesId: number;
            seriesName: string;
            posterPath: null | string;
            episode: components["schemas"]["EpisodeRefDto"];
            /** Format: date-time */
            lastActivityAt: null | string;
            isRewatch: boolean;
        };
        PremiereDto: {
            /** Format: int64 */
            episodeId: number;
            /** Format: int64 */
            seriesId: number;
            seriesName: string;
            posterPath: null | string;
            /** Format: int32 */
            seasonNumber: number;
            /** Format: int32 */
            episodeNumber: number;
            episodeName: null | string;
            stillPath: null | string;
            /** Format: date */
            airDate: string;
            /** Format: date-time */
            releasesAt: null | string;
            isSeasonPremiere: boolean;
            overview: null | string;
            /** Format: date-time */
            lastActivityAt: null | string;
        };
        ProfileDto: {
            displayName: string;
            email: string;
            /** Format: date-time */
            memberSince: string;
            /** Format: int32 */
            seriesTracked: number;
            /** Format: int32 */
            seriesFollowing: number;
            /** Format: int32 */
            seriesFinished: number;
            /** Format: int32 */
            seriesArchived: number;
            /** Format: int32 */
            catalogEpisodes: number;
            /** Format: int32 */
            seriesWithoutMetadata: number;
            /** Format: date-time */
            lastImportedAt: null | string;
        };
        RefreshBody: {
            refreshToken: string;
        };
        RegisterBody: {
            email: string;
            password: string;
            displayName: string;
            userName: null | string;
        };
        RegistrationDto: {
            email: string;
            emailSent: boolean;
            message: string;
        };
        ResendBody: {
            email: string;
        };
        RewatchSessionDto: {
            /** Format: int32 */
            ordinal: number;
            /** Format: date-time */
            startedAt: string;
            /** Format: date-time */
            endedAt: string;
            /** Format: int32 */
            exhibitions: number;
            /** Format: int32 */
            distinctEpisodes: number;
            /** Format: int64 */
            totalSeconds: number;
            /** Format: int32 */
            spanDays: number;
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
            tvdbId: null | number;
            name: string;
            originalName: null | string;
            overview: null | string;
            posterPath: null | string;
            status: string;
            productionStatus: null | string;
            /** Format: date */
            firstAirDate: null | string;
            /** Format: int32 */
            episodesTotal: number;
            /** Format: int32 */
            episodesAired: number;
            /** Format: int32 */
            episodesWatched: number;
            /** Format: double */
            completionRatio: number;
            seasons: components["schemas"]["SeasonDto"][];
            sessions: components["schemas"]["RewatchSessionDto"][];
            /** Format: int32 */
            backfillExhibitions: number;
        };
        SeriesListItemDto: {
            /** Format: int64 */
            id: number;
            /** Format: int32 */
            tvdbId: null | number;
            name: string;
            posterPath: null | string;
            status: string;
            productionStatus: null | string;
            /** Format: int32 */
            episodesTotal: number;
            /** Format: int32 */
            episodesAired: number;
            /** Format: int32 */
            episodesWatched: number;
            /** Format: double */
            completionRatio: number;
            /** Format: date-time */
            lastWatchedAt: null | string;
            nextUp: null | components["schemas"]["EpisodeRefDto"];
        };
        SeriesSearchResultDto: {
            /** Format: int32 */
            tmdbId: number;
            name: string;
            originalName: null | string;
            overview: null | string;
            posterPath: null | string;
            /** Format: date */
            firstAirDate: null | string;
            /** Format: int64 */
            seriesId: null | number;
            trackedStatus: null | string;
        };
        SessionDto: {
            accessToken: string;
            refreshToken: string;
            /** Format: date-time */
            accessTokenExpiresAt: string;
            userId: string;
            displayName: string;
            email: string;
        };
        StatsOverviewDto: {
            summary: components["schemas"]["StatsSummaryDto"];
            byYear: components["schemas"]["TimeBucketDto"][];
            byMonth: components["schemas"]["TimeBucketDto"][];
            topSeries: components["schemas"]["TopSeriesDto"][];
            streaks: components["schemas"]["StreaksDto"];
            availableYears: number[];
        };
        StatsSummaryDto: {
            /** Format: int32 */
            exhibitions: number;
            /** Format: int32 */
            distinctEpisodes: number;
            /** Format: int32 */
            seriesCount: number;
            /** Format: int64 */
            totalSeconds: number;
            /** Format: int32 */
            backfillExhibitions: number;
            /** Format: double */
            rewatchRate: number;
            /** Format: date-time */
            firstWatchedAt: null | string;
            /** Format: date-time */
            lastWatchedAt: null | string;
        };
        StatusBody: {
            status: string;
        };
        StreaksDto: {
            /** Format: int32 */
            longestDays: number;
            /** Format: int32 */
            currentDays: number;
            /** Format: date */
            longestStartedAt: null | string;
            /** Format: date */
            longestEndedAt: null | string;
        };
        TimeBucketDto: {
            label: string;
            /** Format: int32 */
            exhibitions: number;
            /** Format: int64 */
            seconds: number;
        };
        TopSeriesDto: {
            /** Format: int64 */
            seriesId: number;
            name: string;
            /** Format: int32 */
            exhibitions: number;
            /** Format: int32 */
            distinctEpisodes: number;
            /** Format: int64 */
            seconds: number;
        };
        TrackingChange: {
            /** Format: int64 */
            seriesId: number;
            status: string;
        };
        TrackingUpdateResult: {
            /** Format: int32 */
            updated: number;
            notFound: number[];
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
