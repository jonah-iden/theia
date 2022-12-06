// *****************************************************************************
// Copyright (C) 2022 Ericsson and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { ExtensionLike, VSXQueryOptions, VSXSearchOptions } from './ovsx-types';
import { MaybePromise } from './types';

/**
 * @param conditions key/value mapping of condition statements that rules may process
 * @param remainingKeys keys left to be processed, remove items from it when you handled them
 */
export type FilterFactory = (conditions: Readonly<Record<string, unknown>>, remainingKeys: Set<string>) => MaybePromise<OVSXRouterFilter | undefined>;

export interface OVSXRouterFilter {
    filterSearchOptions?(searchOptions?: VSXSearchOptions): MaybePromise<unknown>;
    filterQueryOptions?(queryOptions?: VSXQueryOptions): MaybePromise<unknown>;
    filterExtension?(extension: ExtensionLike): MaybePromise<unknown>;
}

/**
 * Helper function to create factories that handle a single condition key.
 */
export function createFilterFactory(conditionKey: string, factory: (conditionValue: unknown) => OVSXRouterFilter | undefined): FilterFactory {
    return (conditions, remainingKeys) => {
        const filter = factory(conditions[conditionKey]);
        if (filter) {
            remainingKeys.delete(conditionKey);
            return filter;
        }
    };
}

export const RequestContainsRule = createFilterFactory('ifRequestContains', ifRequestContains => {
    if (typeof ifRequestContains === 'string') {
        return new RequestContainsFilter(new RegExp(ifRequestContains, 'i'));
    }
});

export const ExtensionIdMatchesRule = createFilterFactory('ifExtensionIdMatches', ifExtensionIdMatches => {
    if (typeof ifExtensionIdMatches === 'string') {
        return new ExtensionIdMatchesFilter(new RegExp(ifExtensionIdMatches, 'i'));
    }
});

abstract class AbstractRegExpFilter {

    constructor(
        protected regExp: RegExp
    ) { }

    protected test(value: unknown): boolean {
        return typeof value === 'string' && this.regExp.test(value);
    }
}

export class RequestContainsFilter extends AbstractRegExpFilter implements OVSXRouterFilter {
    filterSearchOptions(searchOptions?: VSXSearchOptions): boolean {
        return !searchOptions || [searchOptions.query, searchOptions.category].some(this.test, this);
    }
    filterQueryOptions(queryOptions?: VSXQueryOptions): boolean {
        return !queryOptions || Object.values(queryOptions).some(this.test, this);
    }
}

export class ExtensionIdMatchesFilter extends AbstractRegExpFilter implements OVSXRouterFilter {
    filterExtension(extension: ExtensionLike): boolean {
        return this.test(ExtensionLike.id(extension));
    }
}
