/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * The WASM binary embedded in the generated .js file is derived from FFmpeg
 * (https://ffmpeg.org) and is licensed under the GNU Lesser General Public
 * License v2.1 or later. Source and build instructions:
 * https://github.com/ThaUnknown/mediabunny/tree/main/packages
 */

const EXTRA_CODECS_LOADED_SYMBOL = Symbol.for('@mediabunny/extra-codecs loaded')
if ((globalThis as Record<symbol, unknown>)[EXTRA_CODECS_LOADED_SYMBOL]) {
  console.error(
    '[WARNING]\n@mediabunny/extra-codecs was loaded twice.' +
    ' This will likely cause the decoder not to work correctly.' +
    ' Check if multiple dependencies are importing different versions of @mediabunny/extra-codecs,' +
    ' or if something is being bundled incorrectly.'
  )
}
(globalThis as Record<symbol, unknown>)[EXTRA_CODECS_LOADED_SYMBOL] = true

export { registerCombinedDecoder } from './decoder'
