// Type declarations for UI components — allows any props to avoid strict className requirements
import * as React from 'react';

type AnyProps = Record<string, any>;

export declare function Card(props: AnyProps): JSX.Element;
export declare function CardHeader(props: AnyProps): JSX.Element;
export declare function CardTitle(props: AnyProps): JSX.Element;
export declare function CardDescription(props: AnyProps): JSX.Element;
export declare function CardContent(props: AnyProps): JSX.Element;
export declare function CardFooter(props: AnyProps): JSX.Element;

export declare function Button(props: AnyProps): JSX.Element;
export declare function Badge(props: AnyProps): JSX.Element;
export declare function Input(props: AnyProps): JSX.Element;
export declare function Label(props: AnyProps): JSX.Element;
export declare function Separator(props: AnyProps): JSX.Element;

export declare function ScrollArea(props: AnyProps): JSX.Element;

export declare function TooltipProvider(props: AnyProps): JSX.Element;
export declare function Tooltip(props: AnyProps): JSX.Element;
export declare function TooltipTrigger(props: AnyProps): JSX.Element;
export declare function TooltipContent(props: AnyProps): JSX.Element;

export declare function Dialog(props: AnyProps): JSX.Element;
export declare function DialogTrigger(props: AnyProps): JSX.Element;
export declare function DialogContent(props: AnyProps): JSX.Element;
export declare function DialogHeader(props: AnyProps): JSX.Element;
export declare function DialogFooter(props: AnyProps): JSX.Element;
export declare function DialogTitle(props: AnyProps): JSX.Element;
export declare function DialogDescription(props: AnyProps): JSX.Element;
export declare function DialogClose(props: AnyProps): JSX.Element;
export declare function DialogPortal(props: AnyProps): JSX.Element;

export declare function AlertDialog(props: AnyProps): JSX.Element;
export declare function AlertDialogTrigger(props: AnyProps): JSX.Element;
export declare function AlertDialogContent(props: AnyProps): JSX.Element;
export declare function AlertDialogHeader(props: AnyProps): JSX.Element;
export declare function AlertDialogFooter(props: AnyProps): JSX.Element;
export declare function AlertDialogTitle(props: AnyProps): JSX.Element;
export declare function AlertDialogDescription(props: AnyProps): JSX.Element;
export declare function AlertDialogAction(props: AnyProps): JSX.Element;
export declare function AlertDialogCancel(props: AnyProps): JSX.Element;

export declare function Select(props: AnyProps): JSX.Element;
export declare function SelectTrigger(props: AnyProps): JSX.Element;
export declare function SelectContent(props: AnyProps): JSX.Element;
export declare function SelectItem(props: AnyProps): JSX.Element;
export declare function SelectValue(props: AnyProps): JSX.Element;
export declare function SelectGroup(props: AnyProps): JSX.Element;
export declare function SelectLabel(props: AnyProps): JSX.Element;
export declare function SelectSeparator(props: AnyProps): JSX.Element;

export declare function Table(props: AnyProps): JSX.Element;
export declare function TableHeader(props: AnyProps): JSX.Element;
export declare function TableBody(props: AnyProps): JSX.Element;
export declare function TableFooter(props: AnyProps): JSX.Element;
export declare function TableRow(props: AnyProps): JSX.Element;
export declare function TableHead(props: AnyProps): JSX.Element;
export declare function TableCell(props: AnyProps): JSX.Element;
export declare function TableCaption(props: AnyProps): JSX.Element;
