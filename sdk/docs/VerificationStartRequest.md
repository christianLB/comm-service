# VerificationStartRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**method** | [**VerificationMethod**](VerificationMethod.md) |  | [default to undefined]
**purpose** | **string** |  | [default to undefined]
**to** | [**To**](To.md) |  | [default to undefined]
**mode** | [**VerificationMode**](VerificationMode.md) |  | [default to undefined]
**ttl_seconds** | **number** |  | [optional] [default to 600]

## Example

```typescript
import { VerificationStartRequest } from '@k2600x/comm-service-sdk';

const instance: VerificationStartRequest = {
    method,
    purpose,
    to,
    mode,
    ttl_seconds,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
