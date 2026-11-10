import { useState } from "react";
import { Building2, Mail, Phone, Globe, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { platformApi } from "../../services/platformApi";
import type { PlatformOrganization } from "../../types/platform_admin";
import PlatformActionModal from "./PlatformActionModal";

export default function EditOrganizationContact({
  organization,
  onClose,
  onSuccess,
}: {
  organization: PlatformOrganization;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const client = useQueryClient();
  const [values, setValues] = useState({
    name: organization.name,
    billing_email: organization.billing_email || "",
    contact_phone: organization.contact_phone || "",
    tax_id: organization.tax_id || "",
    website: organization.website || "",
  });
  return (
    <PlatformActionModal
      title="Editar contacto"
      description={
        organization.name +
        ". Actualiza los datos de la organización; no cambia correos de acceso ni credenciales."
      }
      onClose={onClose}
      onSuccess={onSuccess}
      confirmDisabled={!values.name.trim()}
      onConfirm={async (reason) => {
        await platformApi.patch(
          "platform-admin/organizations/" + organization.id + "/contact/",
          { ...values, reason },
        );
        await Promise.all(
          [
            "platform-admin-orgs",
            "platform-admin-org-detail",
            "platform-admin-users",
            "platform-user-detail",
            "beta-admin",
          ].map((key) => client.invalidateQueries({ queryKey: [key] })),
        );
      }}
    >
      <div className="space-y-5">
        <section aria-labelledby="contact-identity-heading">
          <h3
            id="contact-identity-heading"
            className="mb-3 flex items-center gap-2 text-sm font-semibold"
          >
            <Building2
              size={16}
              className="text-accent-green"
              aria-hidden="true"
            />
            Identidad de la organización
          </h3>
          <label className="block text-sm text-text-muted">
            Nombre de organización
            <input
              className="platform-field"
              required
              maxLength={254}
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
            />
          </label>
        </section>
        <section
          className="border-t border-border-base pt-4"
          aria-labelledby="contact-channels-heading"
        >
          <h3
            id="contact-channels-heading"
            className="mb-1 text-sm font-semibold"
          >
            Canales de contacto
          </h3>
          <p className="mb-3 text-xs leading-relaxed text-text-muted">
            Datos comerciales para localizar al cliente. El correo de inicio de
            sesión se conserva.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-text-muted">
              <span className="inline-flex items-center gap-2">
                <Mail size={14} aria-hidden="true" />
                Correo de facturación
              </span>
              <input
                className="platform-field"
                type="email"
                maxLength={254}
                value={values.billing_email}
                onChange={(e) =>
                  setValues({ ...values, billing_email: e.target.value })
                }
              />
            </label>
            <label className="block text-sm text-text-muted">
              <span className="inline-flex items-center gap-2">
                <Phone size={14} aria-hidden="true" />
                Teléfono de contacto
              </span>
              <input
                className="platform-field"
                type="text"
                maxLength={50}
                value={values.contact_phone}
                onChange={(e) =>
                  setValues({ ...values, contact_phone: e.target.value })
                }
              />
            </label>
          </div>
        </section>
        <div className="grid gap-4 border-t border-border-base pt-4 sm:grid-cols-2">
          <label className="block text-sm text-text-muted">
            <span className="inline-flex items-center gap-2">
              <FileText size={14} aria-hidden="true" />
              Identificación fiscal
            </span>
            <input
              className="platform-field"
              maxLength={50}
              value={values.tax_id}
              onChange={(e) => setValues({ ...values, tax_id: e.target.value })}
            />
          </label>
          <label className="block text-sm text-text-muted">
            <span className="inline-flex items-center gap-2">
              <Globe size={14} aria-hidden="true" />
              Sitio web
            </span>
            <input
              className="platform-field"
              type="url"
              maxLength={254}
              value={values.website}
              onChange={(e) =>
                setValues({ ...values, website: e.target.value })
              }
            />
          </label>
        </div>
      </div>
    </PlatformActionModal>
  );
}
