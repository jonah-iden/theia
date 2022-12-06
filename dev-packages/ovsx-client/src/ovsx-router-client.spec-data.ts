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

/* eslint-disable no-null/no-null */

import { OVSXMockClient } from './ovsx-mock-client';
import { RequestContainsRule, ExtensionIdMatchesRule } from './ovsx-router-filters';
import { OVSXClient } from './ovsx-types';

export const registries = {
    internal: 'https://internal.testdomain/',
    public: 'https://public.testdomain/'
};

export const clients: Record<string, OVSXMockClient> = {
    [registries.internal]: new OVSXMockClient(
        [
            'some.a@1.0.0',
            'other.d',
            'secret.x',
            'secret.y',
            'secret.z'
        ],
        registries.internal
    ),
    [registries.public]: new OVSXMockClient(
        [
            'some.a@2.0.0',
            'some.b',
            'other.e',
            'testFullStop.c',
            'secret.w'
        ],
        registries.public
    )
};

export const rules = {
    requests: [
        RequestContainsRule,
    ],
    results: [
        ExtensionIdMatchesRule
    ]
};

export function getClient(uri: string): OVSXClient {
    const client = clients[uri];
    if (!client) {
        throw new Error(`unknown client for URI=${uri}`);
    }
    return client;
};
