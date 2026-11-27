import { CratestackRuntime, type CratestackClientOptions, type CratestackResponseEnvelope } from "./runtime";
import { reviveWireFields, revivePagedWireFields, reviveWireScalar } from "./models";
import type {
  NewProjectInput,
  UpsertStorePreflightInput,
  NewCardInput,
  PatchCardInput,
  MoveCardInput,
  DeleteCardInput,
  DeleteCardResult,
  Project,
  ProjectWhere,
  ProjectOrderByClause,
  ProjectFindMany,
  StorePreflight,
  StorePreflightWhere,
  StorePreflightOrderByClause,
  StorePreflightFindMany,
  BoardCard,
  BoardCardWhere,
  BoardCardOrderByClause,
  BoardCardFindMany,
  CreateProjectArgs,
  UpsertStorePreflightArgs,
  CreateCardArgs,
  UpdateCardArgs,
  MoveCardArgs,
  DeleteCardArgs,
  BoardColumn,
  ProjectSortField,
  StorePreflightSortField,
  BoardCardSortField,
  Page,
  CursorPage,
} from "./models";
import {
  toSearchQuery,
  withIfMatchHeader,
  type CratestackQueryRequestConfig,
  type CratestackRequestConfig,
  type CratestackWriteRequestConfig,
} from "./queries";

export class FactoryBoardSdkClient {
  readonly runtime: CratestackRuntime;
  readonly procedures: ProceduresApi;
  readonly projects: ProjectApi;
  readonly storePreflights: StorePreflightApi;
  readonly boardCards: BoardCardApi;

  constructor(originOrRuntime: string | CratestackRuntime, options: CratestackClientOptions = {}) {
    this.runtime = typeof originOrRuntime === "string"
      ? new CratestackRuntime(originOrRuntime, options)
      : originOrRuntime;
    this.procedures = new ProceduresApi(this.runtime);
    this.projects = new ProjectApi(this.runtime);
    this.storePreflights = new StorePreflightApi(this.runtime);
    this.boardCards = new BoardCardApi(this.runtime);
  }
}

export class ProjectApi {
  constructor(private readonly runtime: CratestackRuntime) {}

  list(options: CratestackQueryRequestConfig = {}): Promise<Project[]> {
    return this.runtime.get<unknown>("/projects", {
      headers: options.headers,
      query: toSearchQuery(options.query),
      signal: options.signal,
    }).then((value) => reviveWireFields(value, 'Project') as Project[]);
  }

  get(id: string, options: CratestackQueryRequestConfig = {}): Promise<Project> {
    return this.runtime.get<unknown>(`/projects/${encodeURIComponent(String(id))}`, {
      headers: options.headers,
      query: toSearchQuery(options.query),
      signal: options.signal,
    }).then((value) => reviveWireFields(value, 'Project') as Project);
  }

  // Same call as `get`, but returns the response alongside the record
  // (issue #610) — read `.response.headers.get("etag")` off the result
  // to get the value `update`/`delete`'s `ifMatch` option needs.
  getWithResponse(
    id: string,
    options: CratestackQueryRequestConfig = {},
  ): Promise<CratestackResponseEnvelope<Project>> {
    return this.runtime.getWithResponse<unknown>(`/projects/${encodeURIComponent(String(id))}`, {
      headers: options.headers,
      query: toSearchQuery(options.query),
      signal: options.signal,
    }).then((result) => ({
      value: reviveWireFields(result.value, 'Project') as Project,
      response: result.response,
    }));
  }

}

export class StorePreflightApi {
  constructor(private readonly runtime: CratestackRuntime) {}

  list(options: CratestackQueryRequestConfig = {}): Promise<StorePreflight[]> {
    return this.runtime.get<unknown>("/store_preflights", {
      headers: options.headers,
      query: toSearchQuery(options.query),
      signal: options.signal,
    }).then((value) => reviveWireFields(value, 'StorePreflight') as StorePreflight[]);
  }

  get(id: string, options: CratestackQueryRequestConfig = {}): Promise<StorePreflight> {
    return this.runtime.get<unknown>(`/store_preflights/${encodeURIComponent(String(id))}`, {
      headers: options.headers,
      query: toSearchQuery(options.query),
      signal: options.signal,
    }).then((value) => reviveWireFields(value, 'StorePreflight') as StorePreflight);
  }

  // Same call as `get`, but returns the response alongside the record
  // (issue #610) — read `.response.headers.get("etag")` off the result
  // to get the value `update`/`delete`'s `ifMatch` option needs.
  getWithResponse(
    id: string,
    options: CratestackQueryRequestConfig = {},
  ): Promise<CratestackResponseEnvelope<StorePreflight>> {
    return this.runtime.getWithResponse<unknown>(`/store_preflights/${encodeURIComponent(String(id))}`, {
      headers: options.headers,
      query: toSearchQuery(options.query),
      signal: options.signal,
    }).then((result) => ({
      value: reviveWireFields(result.value, 'StorePreflight') as StorePreflight,
      response: result.response,
    }));
  }

}

export class BoardCardApi {
  constructor(private readonly runtime: CratestackRuntime) {}

  list(options: CratestackQueryRequestConfig = {}): Promise<BoardCard[]> {
    return this.runtime.get<unknown>("/board_cards", {
      headers: options.headers,
      query: toSearchQuery(options.query),
      signal: options.signal,
    }).then((value) => reviveWireFields(value, 'BoardCard') as BoardCard[]);
  }

  get(id: string, options: CratestackQueryRequestConfig = {}): Promise<BoardCard> {
    return this.runtime.get<unknown>(`/board_cards/${encodeURIComponent(String(id))}`, {
      headers: options.headers,
      query: toSearchQuery(options.query),
      signal: options.signal,
    }).then((value) => reviveWireFields(value, 'BoardCard') as BoardCard);
  }

  // Same call as `get`, but returns the response alongside the record
  // (issue #610) — read `.response.headers.get("etag")` off the result
  // to get the value `update`/`delete`'s `ifMatch` option needs.
  getWithResponse(
    id: string,
    options: CratestackQueryRequestConfig = {},
  ): Promise<CratestackResponseEnvelope<BoardCard>> {
    return this.runtime.getWithResponse<unknown>(`/board_cards/${encodeURIComponent(String(id))}`, {
      headers: options.headers,
      query: toSearchQuery(options.query),
      signal: options.signal,
    }).then((result) => ({
      value: reviveWireFields(result.value, 'BoardCard') as BoardCard,
      response: result.response,
    }));
  }

}

export class ProceduresApi {
  constructor(private readonly runtime: CratestackRuntime) {}

  createProject(args: CreateProjectArgs, options: CratestackRequestConfig = {}): Promise<Project> {
    return this.runtime.post<unknown>("/$procs/createProject", args, options)
      .then((value) => reviveWireFields(value, 'Project') as Project);
  }

  upsertStorePreflight(args: UpsertStorePreflightArgs, options: CratestackRequestConfig = {}): Promise<StorePreflight> {
    return this.runtime.post<unknown>("/$procs/upsertStorePreflight", args, options)
      .then((value) => reviveWireFields(value, 'StorePreflight') as StorePreflight);
  }

  createCard(args: CreateCardArgs, options: CratestackRequestConfig = {}): Promise<BoardCard> {
    return this.runtime.post<unknown>("/$procs/createCard", args, options)
      .then((value) => reviveWireFields(value, 'BoardCard') as BoardCard);
  }

  updateCard(args: UpdateCardArgs, options: CratestackRequestConfig = {}): Promise<BoardCard> {
    return this.runtime.post<unknown>("/$procs/updateCard", args, options)
      .then((value) => reviveWireFields(value, 'BoardCard') as BoardCard);
  }

  moveCard(args: MoveCardArgs, options: CratestackRequestConfig = {}): Promise<BoardCard> {
    return this.runtime.post<unknown>("/$procs/moveCard", args, options)
      .then((value) => reviveWireFields(value, 'BoardCard') as BoardCard);
  }

  deleteCard(args: DeleteCardArgs, options: CratestackRequestConfig = {}): Promise<DeleteCardResult> {
    return this.runtime.post<unknown>("/$procs/deleteCard", args, options)
      .then((value) => reviveWireFields(value, 'DeleteCardResult') as DeleteCardResult);
  }

}