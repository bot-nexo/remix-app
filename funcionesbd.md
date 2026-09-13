
DECLARE
    v_cliente_id UUID;
    v_estado TEXT;
BEGIN
    -- Ignorar si el mensaje fue enviado por el bot/negocio
    IF NEW.from_me IS TRUE THEN
        RETURN NEW;
    END IF;

    -- A. Buscar o Registrar Cliente (Usa 'numero' según tu BD)
    SELECT id INTO v_cliente_id 
    FROM public.clientes 
    WHERE numero = NEW.telefono;

    IF v_cliente_id IS NULL THEN
        INSERT INTO public.clientes (nombre, numero)
        VALUES ('Cliente WhatsApp', NEW.telefono)
        RETURNING id INTO v_cliente_id;
    END IF;

    -- B. Crear/Actualizar estado en conversacion_estado
    -- Si el mensaje contiene palabras de soporte humano, cambiamos a 'HUMANO'
    IF LOWER(NEW.mensaje) SIMILAR TO '%(humano|asesor|persona|hablar|ayuda)%' THEN
        INSERT INTO public.conversacion_estado (telefono, estado, updated_at)
        VALUES (NEW.telefono, 'HUMANO'::estado_conversacion, NOW())
        ON CONFLICT (telefono) 
        DO UPDATE SET estado = 'HUMANO'::estado_conversacion, updated_at = NOW();
    ELSE
        -- Mantener o asegurar en MENU_PRINCIPAL
        INSERT INTO public.conversacion_estado (telefono, estado, updated_at)
        VALUES (NEW.telefono, 'MENU_PRINCIPAL'::estado_conversacion, NOW())
        ON CONFLICT (telefono) DO NOTHING;
    END IF;

    RETURN NEW;
END;

----------------------------------------

DECLARE
    v_data jsonb;
    v_key jsonb;
    v_remote_jid text;
    v_mensaje text;
    v_push_name text;
    v_from_me boolean;
    v_instance text;
    v_cliente_id uuid;
    v_es_lid boolean := false;
    v_identificador_limpio text;
BEGIN
    -- Extraer los bloques principales del JSON de Evolution
    v_data := coalesce(payload->'data', '{}'::jsonb);
    v_instance := coalesce(payload->'instance', 'agentepaula');
    v_key := coalesce(v_data->'key', '{}'::jsonb);
    
    v_remote_jid := coalesce(v_key->>'remoteJid', '');
    v_push_name := coalesce(v_data->>'pushName', 'Cliente WhatsApp');
    v_from_me := coalesce((v_key->>'fromMe')::boolean, false);
    
    v_mensaje := coalesce(
        v_data->'message'->>'conversation',
        v_data->'message'->'extendedTextMessage'->>'text',
        ''
    );

    -- Limpiar el número o ID
    v_identificador_limpio := regexp_replace(split_part(v_remote_jid, '@', 1), '\D', '', 'g');

    -- Validar si es LID
    IF v_remote_jid LIKE '%@lid' 
       OR (v_key->>'addressingMode') = 'lid' 
       OR length(v_identificador_limpio) > 12 THEN
        v_es_lid := true;
    END IF;

    -- 1. Buscar si el cliente ya existe
    IF v_es_lid THEN
        SELECT id INTO v_cliente_id FROM public.clientes WHERE lid = v_identificador_limpio LIMIT 1;
    ELSE
        SELECT id INTO v_cliente_id FROM public.clientes WHERE numero = v_identificador_limpio LIMIT 1;
    END IF;

    -- 2. Crear el cliente si no existe y el mensaje no es propio
    IF v_cliente_id IS NULL AND v_from_me = false THEN
        IF v_es_lid THEN
            INSERT INTO public.clientes (nombre, numero, lid)
            VALUES (v_push_name, NULL, v_identificador_limpio)
            RETURNING id INTO v_cliente_id;
        ELSE
            INSERT INTO public.clientes (nombre, numero, lid)
            VALUES (v_push_name, v_identificador_limpio, NULL)
            RETURNING id INTO v_cliente_id;
        END IF;
    END IF;

    -- 3. Guardar el mensaje en la tabla
    INSERT INTO public.mensajes_whatsapp (
        telefono,
        mensaje,
        from_me,
        instance,
        cliente_id
    ) VALUES (
        v_remote_jid,
        v_mensaje,
        v_from_me,
        v_instance,
        v_cliente_id
    );

    RETURN json_build_object('status', 'success', 'cliente_id', v_cliente_id);
END;

----------------------------------

DECLARE
    v_bot_activo boolean := false;
    v_texto_cliente text := '';
    v_texto_profesional text := '';
    v_cliente_id uuid;
    v_target_jid text;
    v_url text := 'https://marvelous-determination-production-ced5.up.railway.app/message/sendText/' || NEW.instance;
    v_apikey text := 'miClaveSuperSeguraEvolution123';
    v_telefono_profesional text;
    v_body jsonb;
BEGIN
    v_target_jid := trim(NEW.telefono);

    IF v_target_jid IS NULL OR v_target_jid = '' THEN
        RETURN NEW;
    END IF;

    -- 1. Consultar estado del bot y teléfono del profesional
    SELECT (valor = 'true') INTO v_bot_activo
    FROM public.configuracion
    WHERE clave = 'bot_activo'
    LIMIT 1;

    SELECT valor INTO v_telefono_profesional
    FROM public.configuracion
    WHERE clave = 'telefono_profesional'
    LIMIT 1;

    v_bot_activo := coalesce(v_bot_activo, true);

    -- 2. Procesar respuesta si el mensaje no es del bot y este está activo
    IF NEW.from_me = false AND v_bot_activo = true THEN

        -- Búsqueda de respaldo de cliente_id si venía nulo
        v_cliente_id := NEW.cliente_id;
        IF v_cliente_id IS NULL THEN
            SELECT id INTO v_cliente_id
            FROM public.clientes
            WHERE numero = v_target_jid 
               OR regexp_replace(numero, '\D', '', 'g') = regexp_replace(split_part(v_target_jid, '@', 1), '\D', '', 'g')
            LIMIT 1;
        END IF;

        -- 3. Determinar mensaje a responder
        IF LOWER(coalesce(NEW.mensaje, '')) SIMILAR TO '%(humano|asesor|persona|hablar|ayuda)%' THEN
            
            v_texto_cliente := '😎 Te estamos transfiriendo con un asesor. En breve se pondrán en contacto contigo. 👩‍💻';
            
            v_texto_profesional := '⚠️ *SOLICITUD DE ASESOR HUMANO*' || chr(10) || chr(10)
                                || 'Un cliente solicita atención:' || chr(10)
                                || '📱 *Cliente:* ' || v_target_jid || chr(10)
                                || '💬 *Mensaje:* "' || coalesce(NEW.mensaje, '') || '"';

            -- Notificar al profesional
            IF v_telefono_profesional IS NOT NULL AND v_telefono_profesional <> '' THEN
                PERFORM net.http_post(
                    url := v_url,
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'apikey', v_apikey
                    ),
                    body := jsonb_build_object(
                        'number', regexp_replace(v_telefono_profesional, '\D', '', 'g'),
                        'text', v_texto_profesional::text
                    )
                );
            END IF;

        ELSE
            -- Enlace con el ID del cliente resuelto
            v_texto_cliente := '¡Hola! 💅 Te damos la bienvenida. Para hablar con un asesor escribe "Asesor" o "Ayuda".'
                            || chr(10) || chr(10)
                            || 'Para consultar disponibilidad y agendar, cancelar o modificar tu cita en línea, ingresa a nuestro sitio web:' 
                            || chr(10) || chr(10) 
                            || '👉 https://angelnailsagenda.netlify.app/reservar?id=' || coalesce(v_cliente_id::text, '');
        END IF;

        -- 4. Construir Body exacto compatible con Evolution API v2 para LIDs y estándar
        IF v_target_jid LIKE '%@lid' THEN
            v_body := jsonb_build_object(
                'number', v_target_jid,
                'remoteJid', v_target_jid,
                'text', v_texto_cliente::text
            );
        ELSE
            v_body := jsonb_build_object(
                'number', regexp_replace(split_part(v_target_jid, '@', 1), '\D', '', 'g'),
                'text', v_texto_cliente::text
            );
        END IF;

        -- 5. Despachar petición
        PERFORM net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', v_apikey
            ),
            body := v_body
        );

    END IF;

    RETURN NEW;
END;


*******************************************************************************
*******************************************************************************
*******************************************************************************

Resumen del flujo
1. Entra webhook desde Evolution con el payload.
2. Se fija el campo fromMe del payload:
- Si fromMe = true → es mensaje del bot/professional desde la misma instancia → se ignora. No se autoresponde el profesional escribiendo desde la misma cuenta que el bot.
3. Si fromMe = false → es mensaje externo (cliente o profesional desde otra cuenta).
4. Se limpia el identificador del remitente:
- Se extrae el número o LID del remoteJid.
- Se detecta si es LID o teléfono.
- Se deja el identificador limpio para: buscar en BD, crear si no existe, responder por Evolution y actualizar estado.
5. Se resuelve quién es el profesional:
- Se lee telefono_profesional desde la BD.
- Si el identificador limpio coincide con el profesional → se valida el texto:
- Si dice exactamente cerrar. → se actualiza en BD conversacion_estado a MENU_PRINCIPAL para ese cliente y se quita la bandera humana → no se responde nada más con el autoresponder en ese mensaje.
- Si no dice cerrar. → se ignora para la lógica del autoresponder, porque es el profesional atendiendo.
6. Si el remitente no es el profesional → es cliente:
- Se busca o crea el cliente en la tabla clientes por teléfono/LID limpio.
- Se guarda o resuelve su uuid.
7. Se decide qué hacer:
- Si bot_activo = false → no hace nada, el profesional maneja WhatsApp.
- Si el cliente pide humano según agentKeywords → se actualiza conversacion_estado a HUMANO para ese teléfono/LID, se notifica una sola vez al profesional por Evolution, y al cliente se le responde que va en atención humana.
- Si no es humano y es FAQ → se responde la FAQ desde config.json.
- Si no es FAQ → se responde defaultSelfService desde config.json.
8. En todas las respuestas que lleven enlace al portal, el link lleva el uuid de clientes, así el PWA sabe quién es y puede ver/modificar/cancelar citas.
9. La BD solo sirve para:
- clientes: buscar/crear y dejar uuid.
- conversacion_estado: guardar HUMANO o MENU_PRINCIPAL por teléfono/LID.
- configuración: saber bot_activo y telefono_profesional.

Qué no hace
- No responde desde funciones o triggers de BD.
- No responde dos veces la misma solicitud humana.
- No supone que el profesional resolvió si no escribe cerrar.
- No carga a la BD con lógica de respuesta.
