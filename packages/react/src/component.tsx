import { useCallback, useRef, useState } from "react";
import type { FileWithPath } from "react-dropzone";
import { useDropzone } from "react-dropzone";

import type {
  ExpandedRouteConfig,
  UploadThingError,
} from "@uploadthing/shared";
import type { UploadFileType } from "uploadthing/client";
import {
  classNames,
  generateClientDropzoneAccept,
  generateMimeTypes,
} from "uploadthing/client";
import type {
  ErrorMessage,
  FileRouter,
  inferEndpointInput,
  inferErrorShape,
} from "uploadthing/server";

import { INTERNAL_uploadthingHookGen } from "./useUploadThing";

const generatePermittedFileTypes = (config?: ExpandedRouteConfig) => {
  const fileTypes = config ? Object.keys(config) : [];

  const maxFileCount = config
    ? Object.values(config).map((v) => v.maxFileCount)
    : [];

  return { fileTypes, multiple: maxFileCount.some((v) => v && v > 1) };
};

const capitalizeStart = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const INTERNAL_doFormatting = (config?: ExpandedRouteConfig): string => {
  if (!config) return "";

  const allowedTypes = Object.keys(config) as (keyof ExpandedRouteConfig)[];

  const formattedTypes = allowedTypes.map((f) => {
    if (f.includes("/")) return `${f.split("/")[1].toUpperCase()} file`;
    return f === "blob" ? "file" : f;
  });

  // Format multi-type uploader label as "Supports videos, images and files";
  if (formattedTypes.length > 1) {
    const lastType = formattedTypes.pop();
    return `${formattedTypes.join("s, ")} and ${lastType}s`;
  }

  // Single type uploader label
  const key = allowedTypes[0];
  const formattedKey = formattedTypes[0];

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { maxFileSize, maxFileCount } = config[key]!;

  if (maxFileCount && maxFileCount > 1) {
    return `${formattedKey}s up to ${maxFileSize}, max ${maxFileCount}`;
  } else {
    return `${formattedKey} (${maxFileSize})`;
  }
};

const allowedContentTextLabelGenerator = (
  config?: ExpandedRouteConfig,
): string => {
  return capitalizeStart(INTERNAL_doFormatting(config));
};

export type UploadthingComponentProps<TRouter extends FileRouter> = {
  [TEndpoint in keyof TRouter]: {
    endpoint: TEndpoint;

    onUploadProgress?: (progress: number) => void;
    onClientUploadComplete?: (
      res?: Awaited<ReturnType<UploadFileType<TRouter>>>,
    ) => void;
    onUploadError?: (error: UploadThingError<inferErrorShape<TRouter>>) => void;
  } & (undefined extends inferEndpointInput<TRouter[TEndpoint]>
    ? {}
    : {
        input: inferEndpointInput<TRouter[TEndpoint]>;
      });
}[keyof TRouter];

const progressHeights: { [key: number]: string } = {
  0: "after:ut-w-0",
  10: "after:ut-w-[10%]",
  20: "after:ut-w-[20%]",
  30: "after:ut-w-[30%]",
  40: "after:ut-w-[40%]",
  50: "after:ut-w-[50%]",
  60: "after:ut-w-[60%]",
  70: "after:ut-w-[70%]",
  80: "after:ut-w-[80%]",
  90: "after:ut-w-[90%]",
  100: "after:ut-w-[100%]",
};

export interface UI_UploadButton {
  btn?: {
    text?: string;
    color?: string;
    backgroundColor?: string;
  };
  description?: string;
  color?: string;
  backgroundColor?: string;
  border?: boolean;
  short?: boolean;
}

/**
 * @example
 * <UploadButton<OurFileRouter>
 *   endpoint="someEndpoint"
 *   onUploadComplete={(res) => console.log(res)}
 *   onUploadError={(err) => console.log(err)}
 *   description={"Image up to 4MB"}
 *   color={"red"}
 *   short={false}
 *   border={true}
 *   btn={{
 *     text: "Click to upload",
 *     color: "yellow",
 *     backgroundColor: "green",
 *   }}
 * />
 * @default
 *  optional props to customize the UploadButton
 *  <UploadButton<OurFileRouter>
 *    {...}
 *    description={"Image up to 4MB"}
 *    color={"rgb(142,	158,	144)"}
 *    backgroundColor={"whitesmoke"}
 *    short={false}
 *    border={true}
 *    btn={{
 *      text: "Select",
 *      color: "black",
 *      backgroundColor: "#EB9C25",
 *    }}
 * />
 */
export function UploadButton<TRouter extends FileRouter>(
  props: FileRouter extends TRouter
    ? ErrorMessage<"You forgot to pass the generic">
    : UploadthingComponentProps<TRouter> & UI_UploadButton,
) {
  // Cast back to UploadthingComponentProps<TRouter> to get the correct type
  // since the ErrorMessage messes it up otherwise
  const $props = props as UploadthingComponentProps<TRouter>;
  const defaultUI_UploadButton: UI_UploadButton = {
    btn: {
      text: "",
      color: "",
      backgroundColor: "",
    },
    description: "",
    color: "",
    backgroundColor: "",
    border: false,
    short: true,
  };
  const $optionalProps = {
    ...defaultUI_UploadButton,
    ...(props as UI_UploadButton),
  } as UI_UploadButton;

  const useUploadThing = INTERNAL_uploadthingHookGen<TRouter>();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { startUpload, isUploading, permittedFileInfo } = useUploadThing(
    $props.endpoint,
    {
      onClientUploadComplete: (res) => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        $props.onClientUploadComplete?.(res);
        setUploadProgress(0);
      },
      onUploadProgress: (p) => {
        setUploadProgress(p);
        $props.onUploadProgress?.(p);
      },
      onUploadError: $props.onUploadError,
    },
  );

  const { fileTypes, multiple } = generatePermittedFileTypes(
    permittedFileInfo?.config,
  );

  const ready = fileTypes.length > 0;

  const getUploadButtonText = (fileTypes: string[]) => {
    if (!(fileTypes.length > 0)) return "Loading...";
    return `Choose File${multiple ? `(s)` : ``}`;
  };

  return (
    <div
      style={{
        borderColor: $optionalProps?.btn?.backgroundColor,
        backgroundColor: $optionalProps?.backgroundColor,
      }}
      className={classNames(
        "ut-flex ut-items-center ut-justify-center ut-gap-1 ut-rounded-lg",
        !$optionalProps?.short ? "ut-flex-row" : "ut-flex-col",
        $optionalProps?.short ? "ut-p-2" : "",
        $optionalProps?.border ? "ut-border" : "",
        "ut-border-blue-600",
      )}
    >
      <label
        style={{ backgroundColor: $optionalProps?.btn?.backgroundColor }}
        className={classNames(
          "ut-relative ut-flex ut-h-10 ut-w-36 ut-cursor-pointer ut-items-center ut-justify-center ut-overflow-hidden ut-rounded-md after:ut-transition-[width] after:ut-duration-500",
          !ready && "ut-cursor-not-allowed ut-bg-blue-400",
          ready &&
            isUploading &&
            `ut-bg-blue-400 after:ut-absolute after:ut-left-0 after:ut-h-full after:ut-bg-blue-600 ${progressHeights[uploadProgress]}`,
          ready && !isUploading && "ut-bg-blue-600",
          $optionalProps?.short ? "" : "ut-rounded-l-md ut-rounded-r-none",
        )}
      >
        <input
          className="ut-hidden"
          type="file"
          ref={fileInputRef}
          multiple={multiple}
          accept={generateMimeTypes(fileTypes ?? [])?.join(", ")}
          onChange={(e) => {
            if (!e.target.files) return;
            const input = "input" in $props ? $props.input : undefined;
            const files = Array.from(e.target.files);
            void startUpload(files, input);
          }}
          disabled={!ready}
        />
        <span
          style={{ color: $optionalProps?.btn?.color }}
          className="ut-z-10 ut-px-3 ut-py-2 ut-text-white"
        >
          {isUploading ? (
            <Spinner />
          ) : (
            $optionalProps?.btn?.text || getUploadButtonText(fileTypes)
          )}
        </span>
      </label>
      <div
        className={classNames(
          "ut-h-[1.25rem]",
          !$optionalProps?.short && "ut-pl-3 ut-pr-20",
        )}
      >
        {fileTypes && (
          <p
            style={{ color: $optionalProps?.color }}
            className="ut-m-0 ut-text-xs ut-leading-5 ut-text-gray-600"
          >
            {$optionalProps?.description ||
              allowedContentTextLabelGenerator(permittedFileInfo?.config)}
          </p>
        )}
      </div>
    </div>
  );
}

export function UploadDropzone<TRouter extends FileRouter>(
  props: FileRouter extends TRouter
    ? ErrorMessage<"You forgot to pass the generic">
    : UploadthingComponentProps<TRouter>,
) {
  // Cast back to UploadthingComponentProps<TRouter> to get the correct type
  // since the ErrorMessage messes it up otherwise
  const $props = props as UploadthingComponentProps<TRouter>;
  const useUploadThing = INTERNAL_uploadthingHookGen<TRouter>();

  const [files, setFiles] = useState<File[]>([]);
  const onDrop = useCallback((acceptedFiles: FileWithPath[]) => {
    setFiles(acceptedFiles);
  }, []);

  const [uploadProgress, setUploadProgress] = useState(0);
  const { startUpload, isUploading, permittedFileInfo } = useUploadThing(
    $props.endpoint,
    {
      onClientUploadComplete: (res) => {
        setFiles([]);
        $props.onClientUploadComplete?.(res);
        setUploadProgress(0);
      },
      onUploadProgress: (p) => {
        setUploadProgress(p);
        $props.onUploadProgress?.(p);
      },
      onUploadError: $props.onUploadError,
    },
  );

  const { fileTypes } = generatePermittedFileTypes(permittedFileInfo?.config);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: fileTypes ? generateClientDropzoneAccept(fileTypes) : undefined,
  });

  const ready = fileTypes.length > 0;

  return (
    <div
      className={classNames(
        "ut-mt-2 ut-flex ut-justify-center ut-rounded-lg ut-border ut-border-dashed ut-border-gray-900/25 ut-px-6 ut-py-10",
        isDragActive ? "ut-bg-blue-600/10" : "",
      )}
    >
      <div className="ut-text-center" {...getRootProps()}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          className="ut-mx-auto ut-block ut-h-12 ut-w-12 ut-align-middle ut-text-gray-400"
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M5.5 17a4.5 4.5 0 0 1-1.44-8.765a4.5 4.5 0 0 1 8.302-3.046a3.5 3.5 0 0 1 4.504 4.272A4 4 0 0 1 15 17H5.5Zm3.75-2.75a.75.75 0 0 0 1.5 0V9.66l1.95 2.1a.75.75 0 1 0 1.1-1.02l-3.25-3.5a.75.75 0 0 0-1.1 0l-3.25 3.5a.75.75 0 1 0 1.1 1.02l1.95-2.1v4.59Z"
            clipRule="evenodd"
          ></path>
        </svg>
        <div className="ut-mt-4 ut-flex ut-text-sm ut-leading-6 ut-text-gray-600">
          <label
            htmlFor="file-upload"
            className={classNames(
              "ut-relative ut-cursor-pointer ut-font-semibold  focus-within:ut-outline-none focus-within:ut-ring-2 focus-within:ut-ring-blue-600 focus-within:ut-ring-offset-2 hover:ut-text-blue-500",
              ready ? "ut-text-blue-600" : "ut-text-gray-500",
            )}
          >
            <span className="ut-flex ut-w-64 ut-items-center ut-justify-center">
              {ready ? `Choose files or drag and drop` : `Loading...`}
            </span>
            <input
              className="ut-sr-only"
              {...getInputProps()}
              disabled={!ready}
            />
          </label>
        </div>
        <div className="ut-h-[1.25rem]">
          <p className="ut-m-0 ut-text-xs ut-leading-5 ut-text-gray-600">
            {allowedContentTextLabelGenerator(permittedFileInfo?.config)}
          </p>
        </div>
        {files.length > 0 && (
          <div className="ut-mt-4 ut-flex ut-items-center ut-justify-center">
            <button
              className={classNames(
                "ut-relative ut-flex ut-h-10 ut-w-36 ut-items-center ut-justify-center ut-overflow-hidden ut-rounded-md after:ut-transition-[width] after:ut-duration-500",
                isUploading
                  ? `ut-bg-blue-400 after:ut-absolute after:ut-left-0 after:ut-h-full after:ut-bg-blue-600 ${progressHeights[uploadProgress]}`
                  : "ut-bg-blue-600",
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!files) return;

                const input = "input" in $props ? $props.input : undefined;
                void startUpload(files, input);
              }}
            >
              <span className="ut-z-10 ut-px-3 ut-py-2 ut-text-white">
                {isUploading ? (
                  <Spinner />
                ) : (
                  `Upload ${files.length} file${files.length === 1 ? "" : "s"}`
                )}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Uploader<TRouter extends FileRouter>(
  props: FileRouter extends TRouter
    ? ErrorMessage<"You forgot to pass the generic">
    : UploadthingComponentProps<TRouter>,
) {
  return (
    <>
      <div className="ut-flex ut-flex-col ut-items-center ut-justify-center ut-gap-4">
        <span className="ut-text-center ut-text-4xl ut-font-bold">
          {`Upload a file using a button:`}
        </span>
        {/* @ts-expect-error - this is validated above */}
        <UploadButton<TRouter> {...props} />
      </div>
      <div className="ut-flex ut-flex-col ut-items-center ut-justify-center ut-gap-4">
        <span className="ut-text-center ut-text-4xl ut-font-bold">
          {`...or using a dropzone:`}
        </span>
        {/* @ts-expect-error - this is validated above */}
        <UploadDropzone<TRouter> {...props} />
      </div>
    </>
  );
}

function Spinner() {
  return (
    <svg
      className="ut-block ut-h-5 ut-w-5 ut-animate-spin ut-align-middle ut-text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 576 512"
    >
      <path
        fill="currentColor"
        d="M256 32C256 14.33 270.3 0 288 0C429.4 0 544 114.6 544 256C544 302.6 531.5 346.4 509.7 384C500.9 399.3 481.3 404.6 465.1 395.7C450.7 386.9 445.5 367.3 454.3 351.1C470.6 323.8 480 291 480 255.1C480 149.1 394 63.1 288 63.1C270.3 63.1 256 49.67 256 31.1V32z"
      />
    </svg>
  );
}

export function generateComponents<TRouter extends FileRouter>() {
  return {
    UploadButton: UploadButton<TRouter>,
    UploadDropzone: UploadDropzone<TRouter>,
    Uploader: Uploader<TRouter>,
  };
}
