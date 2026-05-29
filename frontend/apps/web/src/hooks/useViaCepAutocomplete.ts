import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { lookupAddressByCep } from "@/data/api/viacep";

interface AddressFormFields {
  postalCode: string;
  address: string;
  district: string;
  city: string;
  state: string;
}

interface UseViaCepAutocompleteParams<TFormData extends AddressFormFields> {
  postalCode: string;
  setFormData: Dispatch<SetStateAction<TFormData>>;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
}

function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

export function useViaCepAutocomplete<TFormData extends AddressFormFields>({
  postalCode,
  setFormData,
  setErrors,
}: UseViaCepAutocompleteParams<TFormData>) {
  const [isLoading, setIsLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    if (postalCode.length !== 8) {
      setIsLoading(false);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();
    setIsLoading(true);

    void lookupAddressByCep(postalCode, { signal: controller.signal })
      .then((address) => {
        if (controller.signal.aborted || requestId !== requestRef.current) return;

        if (!address) {
          setErrors((prev) => ({ ...prev, postalCode: "CEP não encontrado." }));
          return;
        }

        setFormData((prev) => {
          if (prev.postalCode !== postalCode) return prev;
          return {
            ...prev,
            address: address.street || prev.address,
            district: address.district || prev.district,
            city: address.city || prev.city,
            state: address.state || prev.state,
          };
        });
        setErrors((prev) => {
          const next = { ...prev };
          delete next.postalCode;
          if (address.street) delete next.address;
          if (address.district) delete next.district;
          if (address.city) delete next.city;
          if (address.state) delete next.state;
          return next;
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId !== requestRef.current || isAbortError(error)) {
          return;
        }
        setErrors((prev) => ({ ...prev, postalCode: "Não foi possível consultar o CEP agora." }));
      })
      .finally(() => {
        if (!controller.signal.aborted && requestId === requestRef.current) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [postalCode, setErrors, setFormData]);

  return { isLoading };
}
