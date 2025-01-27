import {
    importKeyPolyfill,
    exportKeyPolyfill,
    generateKeyPolyfill,
    isPolyfilledKey,
    signPolyfill,
    verifyPolyfill,
} from './secrets';

if (!__BROWSER__ || globalThis.isSecureContext) {
    /**
     * Create `crypto.subtle` if it doesn't exist.
     */
    const originalCryptoObject = (globalThis.crypto ||= {} as Crypto);
    const originalSubtleCrypto = ((originalCryptoObject as Crypto & { subtle: SubtleCrypto }).subtle ||=
        {} as SubtleCrypto);

    /**
     * Override `SubtleCrypto#exportKey`
     */
    const originalExportKey = originalSubtleCrypto.exportKey as SubtleCrypto['exportKey'] | undefined;
    originalSubtleCrypto.exportKey = (async (...args: Parameters<SubtleCrypto['exportKey']>) => {
        const [_, key] = args;
        if (isPolyfilledKey(key)) {
            return exportKeyPolyfill(...args);
        } else if (originalExportKey) {
            return await originalExportKey.apply(originalSubtleCrypto, args);
        } else {
            throw new TypeError('No native `exportKey` function exists to handle this call');
        }
    }) as SubtleCrypto['exportKey'];

    /**
     * Override `SubtleCrypto#generateKey`
     */
    const originalGenerateKey = originalSubtleCrypto.generateKey as SubtleCrypto['generateKey'] | undefined;
    let originalGenerateKeySupportsEd25519: Promise<boolean> | boolean | undefined;
    originalSubtleCrypto.generateKey = (async (...args: Parameters<SubtleCrypto['generateKey']>) => {
        const [algorithm] = args;
        if (algorithm !== 'Ed25519') {
            if (originalGenerateKey) {
                return await originalGenerateKey.apply(originalSubtleCrypto, args);
            } else {
                throw new TypeError('No native `generateKey` function exists to handle this call');
            }
        }
        let optimisticallyGeneratedKeyPair;
        if (originalGenerateKeySupportsEd25519 === undefined) {
            originalGenerateKeySupportsEd25519 = new Promise(resolve => {
                if (!originalGenerateKey) {
                    resolve((originalGenerateKeySupportsEd25519 = false));
                    return;
                }
                originalGenerateKey
                    .apply(originalSubtleCrypto, args)
                    .then(keyPair => {
                        if (__DEV__) {
                            console.warn(
                                '`@solana/webcrypto-ed25519-polyfill` was included in an ' +
                                    'environment that supports Ed25519 key manipulation ' +
                                    'natively. Falling back to the native implementation. ' +
                                    'Consider including this polyfill only in environments where ' +
                                    'Ed25519 is not supported.'
                            );
                        }
                        if (originalSubtleCrypto.generateKey !== originalGenerateKey) {
                            originalSubtleCrypto.generateKey = originalGenerateKey;
                        }
                        optimisticallyGeneratedKeyPair = keyPair;
                        resolve((originalGenerateKeySupportsEd25519 = true));
                    })
                    .catch(() => {
                        resolve((originalGenerateKeySupportsEd25519 = false));
                    });
            });
        }
        if (
            typeof originalGenerateKeySupportsEd25519 === 'boolean'
                ? originalGenerateKeySupportsEd25519
                : await originalGenerateKeySupportsEd25519
        ) {
            if (optimisticallyGeneratedKeyPair) {
                return optimisticallyGeneratedKeyPair;
            } else if (originalGenerateKey) {
                return await originalGenerateKey.apply(originalSubtleCrypto, args);
            } else {
                throw new TypeError('No native `generateKey` function exists to handle this call');
            }
        } else {
            const [_, extractable, keyUsages] = args;
            return generateKeyPolyfill(extractable, keyUsages);
        }
    }) as SubtleCrypto['generateKey'];

    /**
     * Override `SubtleCrypto#sign`
     */
    const originalSign = originalSubtleCrypto.sign as SubtleCrypto['sign'] | undefined;
    originalSubtleCrypto.sign = (async (...args: Parameters<SubtleCrypto['sign']>) => {
        const [_, key] = args;
        if (isPolyfilledKey(key)) {
            const [_, ...rest] = args;
            return signPolyfill(...rest);
        } else if (originalSign) {
            return await originalSign.apply(originalSubtleCrypto, args);
        } else {
            throw new TypeError('No native `sign` function exists to handle this call');
        }
    }) as SubtleCrypto['sign'];

    /**
     * Override `SubtleCrypto#verify`
     */
    const originalVerify = originalSubtleCrypto.verify as SubtleCrypto['verify'] | undefined;
    originalSubtleCrypto.verify = (async (...args: Parameters<SubtleCrypto['verify']>) => {
        const [_, key] = args;
        if (isPolyfilledKey(key)) {
            const [_, ...rest] = args;
            return verifyPolyfill(...rest);
        } else if (originalVerify) {
            return await originalVerify.apply(originalSubtleCrypto, args);
        } else {
            throw new TypeError('No native `verify` function exists to handle this call');
        }
    }) as SubtleCrypto['verify'];

    /**
     * Override `SubtleCrypto#importKey`
     */
    const originalImportKey = originalSubtleCrypto.importKey as SubtleCrypto['importKey'] | undefined;
    originalSubtleCrypto.importKey = (async (...args: Parameters<SubtleCrypto['importKey']>) => {
        const [format, keyData, algorithm, extractable, keyUsages] = args;

        // States to handle:
        // importkey does not exist
        // importkey exists and supports Ed25519
        // importkey exists and doesn't support Ed25519

        if (!originalImportKey) {
            if (algorithm === 'Ed25519') {
                return importKeyPolyfill(format, keyData, extractable, keyUsages);
            } else {
                throw new TypeError('No native `importKey` function exists to handle this call');
            }
        } else if (algorithm === 'Ed25519') {
            return originalImportKey
                .apply(originalSubtleCrypto, args)
                .then(res => {
                    if (__DEV__) {
                        console.warn(
                            '`@solana/webcrypto-ed25519-polyfill` was included in an ' +
                                'environment that supports Ed25519 key manipulation ' +
                                'natively. Falling back to the native implementation. ' +
                                'Consider including this polyfill only in environments where ' +
                                'Ed25519 is not supported.'
                        );
                    }
                    return res;
                })
                .catch(err => {
                    if (err.name === 'NotSupportedError') {
                        return importKeyPolyfill(format, keyData, extractable, keyUsages);
                    } else {
                        throw err;
                    }
                });
        } else {
            return originalImportKey.apply(originalSubtleCrypto, args);
        }
    }) as SubtleCrypto['importKey'];
}
