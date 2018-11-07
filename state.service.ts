import { Injectable, Type } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RoutesRecognized } from '@angular/router';

import { map, filter, tap } from 'rxjs/operators';
import { Subject, Observable } from 'rxjs';

const convertToMap = (params: { [key: string]: any; }): Map<string, any> => {
  const paramMap = new Map<string, any>();
  Object.keys(params).forEach(k => {
    paramMap.set(k, params[k]);
  });
  return paramMap;
};

@Injectable()
export class StateService {
  activeState: State;
  changes = new StateChanges;
  urlWasFixed = false;
  urlNeedsFixed = false;
  // hasAppChanges = false;
  // hasComponentChanges = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {
    // console.log(route);
    // console.log(router);
    this.activeState = new State();
    this.initEvents();
  }

  get activeComponent() {
    return this.activeState.snapshot.component;
  }

  public has(item: { [key: string]: string }): boolean {
    return this.hasKeyValue({ key: item.key, value: item.value });
  }

  public hasKeyValue(item: { key: string, value?: string }): boolean {
    const state = this.activeState.snapshot.paramMap;
    console.log(`state has '${item.key}: ${state.has(item.key)}; state val: ${state.get(item.key)}; item val: ${item.value}`);
    if (state.has(item.key) && typeof state.get(item.key) !== typeof item.value) {
      // tslint:disable-next-line:max-line-length
      console.warn(`state '${item.key}' is of type '${typeof state.get(item.key)}'; item '${item.key}' is of type '${typeof item.value}';\ncomparing apples to oranges will never work!\nI'll coerce them both to strings first, cross your fingers...`);
    }
    return state.has(item.key) && (item.value == null || state.get(item.key).toString() === item.value.toString());
  }

  public alterComponentState(additions?: { [key: string]: string; }, deletions?: string[] | { [key: string]: string; }) {

    let stateWasAdded = false;
    if (additions) {
      console.log('altering component state with additions', additions);

      Object.getOwnPropertyNames(additions).forEach(k => {
        if (!this.hasKeyValue({ key: k, value: additions[k] })) {
          console.log(`adding '${k}=${additions[k]}' to component state`);
          this.activeState.snapshot.componentParams[k] = additions[k];
          this.changes.component.adds[k] = additions[k];
          stateWasAdded = true;
        }
      });
      if (!stateWasAdded) {
        console.log('state already has the additions, thus no change to state was performed.');
      }
    }
    let stateWasDeleted = false;
    if (deletions) {
      console.log('altering component state with deletions', deletions);
      if (deletions instanceof Array) {
        deletions.forEach(k => {
          if (this.activeState.snapshot.componentParams.hasOwnProperty(k)) {
            console.log(`deleting '${k}' from component state`);
            delete this.activeState.snapshot.componentParams[k];
            this.changes.component.deletes.push(k);
            stateWasDeleted = true;
          }
        });
      } else {
        Object.keys(deletions).forEach(k => {
          if (this.activeState.snapshot.componentParams.hasOwnProperty(k)) {
            console.log(`deleting '${k}' from component state`);
            delete this.activeState.snapshot.componentParams[k];
            this.changes.component.deletes.push(k);
            stateWasDeleted = true;
          }
        });
      }
      if (!stateWasDeleted) {
        console.log('state did not have the deletions, thus no change to state was performed.');
      }
    }

    if (stateWasAdded || stateWasDeleted) {
      this.activeState.snapshot.params = { ...this.activeState.snapshot.appParams, ...this.activeState.snapshot.componentParams };
      this.urlWasFixed = true;
      // this.hasComponentChanges = true;
      console.log('navigating to fix the url due to alterComponentState', this.activeState.snapshot.componentParams);
      // THE BELOW WILL NOT WORK IF NAVIGATING TO THE SAME PATH.
      // So the workaround (router.navigateByUrl) is being used.
      // this.router.navigate(['./', this.activeState.snapshot.componentParams], {
      //   relativeTo: this.route.firstChild,
      //   queryParams: this.activeState.snapshot.appParams,
      //   replaceUrl: true,
      //   // queryParamsHandling: 'merge',
      //   skipLocationChange: false
      // }).then((r) => {
      //   if (r === null) {
      //     console.log('router.navigate failed');
      //   }
      // });
      const urlTree = this.router.parseUrl(this.router.url);
      const segments = urlTree.root.children.primary.segments;
      const segment = segments[segments.length - 1];
      Object.assign(segment.parameters, this.activeState.snapshot.componentParams);
      this.router.navigateByUrl(this.router.serializeUrl(urlTree), { queryParamsHandling: 'merge' });
    }
  }

  public alterAppState(additions?: { [key: string]: string; }, deletions?: string[] | { [key: string]: string; }) {
    let stateWasDeleted = false;
    if (deletions) {
      console.log('altering app state with deletions', deletions);
      if (deletions instanceof Array) {
        // console.log('deletions are a string[]');
        deletions.forEach(k => {
          if (this.activeState.snapshot.appParams.hasOwnProperty(k)) {
            console.log(`deleting '${k}' from app state`);
            this.changes.app.deletes.push(k);
            delete this.activeState.snapshot.appParams[k];
            stateWasDeleted = true;
          }
        });
      } else {
        Object.keys(deletions).forEach(k => {
          if (this.activeState.snapshot.appParams.hasOwnProperty(k)) {
            console.log(`deleting '${k}' from app state`);
            this.changes.app.deletes.push(k);
            delete this.activeState.snapshot.appParams[k];
            stateWasDeleted = true;
          }
        });
      }
      if (!stateWasDeleted) {
        console.log('state did not have the deletions, thus no change to state was performed.');
      }
      // console.log('appParams after deletion', this.activeState.snapshot.appParams);
    }
    let stateWasAdded = false;
    // let appParams = Object.assign({}, this.activeState.snapshot.appParams);
    if (additions) {
      console.log('altering app state with additions', additions);
      Object.keys(additions).forEach(k => {
        if (!this.hasKeyValue({ key: k, value: additions[k] })) {
          console.log(`adding '${k}=${additions[k]}' to app state`);
          this.activeState.snapshot.appParams[k] = additions[k];
          this.changes.app.adds[k] = additions[k];
          stateWasAdded = true;
        }
      });
      if (!stateWasAdded) {
        console.log('state already has the additions, thus no change to state was performed.');
      }
      // console.log('appParams after additions', this.activeState.snapshot.appParams);
    }

    if (stateWasAdded || stateWasDeleted) {
      this.activeState.snapshot.params = { ...this.activeState.snapshot.appParams, ...this.activeState.snapshot.componentParams };
      if (this.router.navigated) {  // unique to app state since router would have had to have navigated if component params are being set.
        console.log('navigating to fix the url due to alterAppState', this.activeState.snapshot.appParams);
        this.urlWasFixed = true;
        // this.hasAppChanges = true;
        this.router.navigate(['./', this.activeState.snapshot.componentParams], {
          // relativeTo: (this.route.firstChild || this.route),
          queryParams: this.activeState.snapshot.appParams,
          replaceUrl: true,
          // queryParamsHandling: 'merge',
          skipLocationChange: false
        });
      } else {
        // ONLY HAPPENS IF INITIAL NAVIGATION HAS NOT YET OCCURRED.
        // Example: browser reload and header component is altering app state.
        this.urlNeedsFixed = true;
      }
    }
  }

  private initEvents(): any {
    // Approach...
    // Latch routing event nearest to guard checks to ensure State is up-to-date for app param evaluations.
    // Latch routing event at the end of life cycle to sync any State changes back into Url, if absent.

    // * The sequence of router events is:
    // * - `NavigationStart`,
    // * - `RouteConfigLoadStart`,
    // * - `RouteConfigLoadEnd`,
    // * - `RoutesRecognized`,
    // * - `GuardsCheckStart`,
    // * - `ChildActivationStart`,
    // * - `ActivationStart`,
    // * - *CanActivate*
    // * - `GuardsCheckEnd`,
    // * - `ResolveStart`,
    // * - `ResolveEnd`,
    // * - `ActivationEnd`
    // * - `ChildActivationEnd`
    // * - `NavigationEnd`,
    // * - `NavigationCancel`,
    // * - `NavigationError`
    // * - `Scroll`
    // Note: `ActivationStart` is the final event before *CanActivate* is called. Thus, this would be the perfect
    // event to latch in order to ensure state service is done configuring state before route/component guard checks
    // are performed. However, `ActivationStart` event is not always fired so go with RoutesRecognized...
    this.router.events.pipe(
      filter(e => e instanceof RoutesRecognized),
      // distinctUntilChanged((a: RoutesRecognized, b: RoutesRecognized) => {
      //   // ************************************************************************************
      //   // This code will not execute on the very first navigation.
      //   // On the 1 + nth navigation, if we need to compare routes for some reason
      //   // do it here.
      //   // console.log('a', a, 'b', b);
      //   const prevPath = a.url.split(';')[0].split('?')[0];
      //   const nextPath = b.url.split(';')[0].split('?')[0];
      //   // console.log('prevPath', prevPath, 'nextPath', nextPath);
      //   if (prevPath === nextPath) {
      //   } else {
      //     console.log('path change');
      //   }
      //   return false;
      // }),
      tap((e: RoutesRecognized) => {
        console.log('RoutesRecognized', e);

        // ************************************************************************************
        // Build state NOW from route params (maxtrix and query).
        // If router.navigated === false then this is the initial state setup.
        const queryParams = e.state.root.firstChild.queryParams;
        const qpKeys = Object.getOwnPropertyNames(queryParams);
        console.log('query params', queryParams);
        const matrixParams = e.state.root.firstChild.params;
        const mpKeys = Object.getOwnPropertyNames(matrixParams);
        console.log('matrix params', matrixParams);
        if (this.router.navigated) {
          console.log('state change check...');
          // ...STATE HAS PREVIOUSLY BEEN INITIALIZED
          // 1. The Url may have been manipulated via [routerLink] or router.navigate
          //    *If the Url was manipulated State will need to be synced.
          // 2. State may have been manipulated via alterXxxState()
          //    *If state was manipulated it has performed a url 'fix' navigation
          //     and we can detect that.
          //     this.urlWasFixed === true; means alterXxxState() performed a sync navigation
          //     so we don't need to change check and sync.
          if (this.urlWasFixed) {
            console.log('url sync navigation was performed by alterXxxState(), change check not needed.');
            this.urlWasFixed = false;
            return;
          } else {
            // deletes
            Object.getOwnPropertyNames(this.activeState.snapshot.appParams).forEach(k => {
              if (!qpKeys.includes(k)) {
                console.log(`deleting app state ${k} since it is not in the query params`);
                delete this.activeState.snapshot.appParams[k];
                this.changes.app.deletes.push(k);
                // this.hasAppChanges = true;
              }
            });
            // adds
            qpKeys.forEach(k => {
              if (!this.hasKeyValue({ key: k, value: queryParams[k] })) {
                console.log(`adding app state ${k} since it is not in the query params`);
                this.activeState.snapshot.appParams[k] = queryParams[k];
                this.changes.app.deletes.push(k);
                // this.hasAppChanges = true;
              }
            });
            // this.hasAppChanges = !deepEqual(appParams, queryParams);
            if (Object.getOwnPropertyNames(this.changes.app.adds).length > 0 || this.changes.app.deletes.length > 0) {
              console.log('app param changes detected, state modified');
              console.log('state app params after merge', this.activeState.snapshot.appParams);
            }

            // And check matrix params for changes to component state
            // deletes
            Object.getOwnPropertyNames(this.activeState.snapshot.componentParams).forEach(k => {
              if (!mpKeys.includes(k)) {
                console.log(`deleting component state ${k} since it is not in the matrix params`);
                delete this.activeState.snapshot.componentParams[k];
                this.changes.component.deletes.push(k);
                // this.hasComponentChanges = true;
              }
            });
            // adds
            mpKeys.forEach(k => {
              if (!this.hasKeyValue({ key: k, value: matrixParams[k] })) {
                console.log(`adding component state ${k} since it is in the matrix params`);
                this.activeState.snapshot.componentParams[k] = matrixParams[k];
                this.changes.component.adds[k] = matrixParams[k];
                // this.hasComponentChanges = true;
              }
            });
            // this.hasComponentChanges = !deepEqual(componentParams, routeParams);
            if (Object.getOwnPropertyNames(this.changes.component.adds).length > 0 || this.changes.component.deletes.length > 0) {
              console.log('component param changes detected, state modified');
              console.log('state component params after merge', this.activeState.snapshot.componentParams);
            }
            // If there are changes from previous url 'fixing' navigation
            // or from alterState() or path change, drop through (subscribe will be called in NavigationEnd).
            if (Object.getOwnPropertyNames(this.changes.app.adds).length > 0 || this.changes.app.deletes.length > 0 ||
              Object.getOwnPropertyNames(this.changes.component.adds).length > 0 || this.changes.component.deletes.length > 0) {
              // update universal params with any changes
              this.activeState.snapshot.params = { ...this.activeState.snapshot.appParams, ...this.activeState.snapshot.componentParams };
              console.log('hasXxxChanges so state should be broadcast.');
            }
          }
        } else {
          // ...INITIALIZING STATE
          // 1. State may have been manipulated via alterXxxState()
          //     this.urlNeedsFixed === true; means alterXxxState() could not perform a
          //     sync navigation and the sync navigation still needs to occur.
          // 2. Simply take all matrix and query params and put them in state.
          console.log('Router has not yet navigated.');
          console.log('initializing state...');
          // 1.
          if (this.urlNeedsFixed) {
            // It's possible the url already has the initial state represented
            let syncRequired = false;
            Object.getOwnPropertyNames(this.activeState.snapshot.appParams).forEach(k => {
              if (!queryParams[k] || queryParams[k] !== this.activeState.snapshot.appParams[k]) {
                syncRequired = true;
              }
            });
            Object.getOwnPropertyNames(this.activeState.snapshot.componentParams).forEach(k => {
              if (!matrixParams[k] || matrixParams[k] !== this.activeState.snapshot.componentParams[k]) {
                syncRequired = true;
              }
            });
            if (syncRequired) {
              console.log('will perform url sync navigation in NavigationEnd...');
            } else {
              this.urlNeedsFixed = false;
            }
          }
          // 2.
          qpKeys.forEach(k => this.activeState.snapshot.appParams[k] = queryParams[k]);
          mpKeys.forEach(k => this.activeState.snapshot.componentParams[k] = matrixParams[k]);
          this.activeState.snapshot.params = { ...this.activeState.snapshot.appParams, ...this.activeState.snapshot.componentParams };
          console.log('state intialized to:', this.activeState.snapshot.params);
          if (Object.getOwnPropertyNames(this.activeState.snapshot.appParams).length > 0) {
            this.changes.app.adds = Object.assign({}, queryParams);
          }
          if (Object.getOwnPropertyNames(this.activeState.snapshot.componentParams).length > 0) {
            this.changes.component.adds = Object.assign({}, matrixParams);
          }
        }
      }),
    ).subscribe(_ => console.log('RoutesRecognized completed.'));

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      tap(e => {
        console.log('NavigationEnd', e);
      }),
      filter((e: NavigationEnd) => {
        if (this.urlNeedsFixed) {
          console.log('performing url sync navigation.');
          this.urlNeedsFixed = false;
          this.router.navigate(['./', this.activeState.snapshot.componentParams], {
            relativeTo: this.route,
            queryParams: this.activeState.snapshot.appParams,
            replaceUrl: true,
            skipLocationChange: false
          });
          return false;
        }
        return Object.getOwnPropertyNames(this.changes.app.adds).length > 0 || this.changes.app.deletes.length > 0 ||
          Object.getOwnPropertyNames(this.changes.component.adds).length > 0 || this.changes.component.deletes.length > 0;
      })
    ).subscribe(_ => {
      // this code should only be reached if in fact there are changes to broadcast
      console.log('broadcasting state changes');
      this.activeState.next(this.activeState.snapshot, this.changes);
      // reset change flags
      // this.hasAppChanges = this.hasComponentChanges = false;
      // reset changes
      this.changes = new StateChanges();
      // console.log(`change flags reset? ${!(this.hasAppChanges || this.hasComponentChanges)}`);
    });
  }
}

class State {
  public params = new Subject<{ [key: string]: any; }>();
  public appParams = new Subject<{ [key: string]: any; }>();
  public appChanges = new Subject<{ adds: { [key: string]: string; }, deletes: string[] }>();
  public componentParams = new Subject<{ [key: string]: any; }>();
  public componentChanges = new Subject<{ adds: { [key: string]: string; }, deletes: string[] }>();
  public snapshot = new StateSnapshot({}, {}, {}, null);

  constructor() { }

  specificAppChange(key: string) {
    return this.appChanges.pipe(
      filter(chgs => !!chgs.adds[key] || chgs.deletes.includes(key)),
      map(chgs => chgs.adds[key])
    );
  }

  specificComponentChange(key: string) {
    return this.componentChanges.pipe(
      filter(chgs => !!chgs.adds[key] || chgs.deletes.includes(key)),
      map(chgs => chgs.adds[key])
    );
  }

  get paramMap(): Observable<Map<string, any>> {
    return this.params.pipe(
      map(p => convertToMap(p))
    );
  }

  get appParamMap(): Observable<Map<string, any>> {
    return this.appParams.pipe(
      map(p => convertToMap(p))
    );
  }

  get componentParamMap(): Observable<Map<string, any>> {
    return this.componentParams.pipe(
      map(p => convertToMap(p))
    );
  }

  next(snapshot: StateSnapshot, changes: StateChanges) {
    const appChanges = Object.getOwnPropertyNames(changes.app.adds).length > 0 || changes.app.deletes.length > 0;
    const componentChanges = Object.getOwnPropertyNames(changes.component.adds).length > 0 || changes.component.deletes.length > 0;
    console.log(`has app changes? ${appChanges}`);
    console.log(`has component changes? ${componentChanges}`);
    if (appChanges || componentChanges) {
      this.snapshot = snapshot;
      this.params.next(this.snapshot.params);
    }
    if (appChanges) {
      this.appParams.next(this.snapshot.appParams);
      this.appChanges.next({ adds: changes.app.adds, deletes: changes.app.deletes });
    }
    if (componentChanges) {
      this.componentParams.next(this.snapshot.componentParams);
      this.componentChanges.next({ adds: changes.component.adds, deletes: changes.component.deletes });
    }
  }
}

class StateSnapshot {

  constructor(
    public params: { [key: string]: string; },
    public appParams: { [key: string]: string; },
    public componentParams: { [key: string]: string; },
    public component: Type<any> | string | null,
  ) { }

  get paramMap(): Map<string, any> {
    return convertToMap(this.params);
  }

  get appParamMap(): Map<string, any> {
    return convertToMap(this.appParams);
  }

  get componentParamMap(): Map<string, any> {
    return convertToMap(this.componentParams);
  }
}

class StateChanges {
  constructor(
    public app?: {
      adds?: { [key: string]: string },
      deletes?: string[]
    },
    public component?: {
      adds?: { [key: string]: string },
      deletes?: string[]
    }
  ) {
    this.app = app || { adds: {}, deletes: [] };
    this.component = component || { adds: {}, deletes: [] };
  }
}
