import { useDroppable, DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { CollisionPriority } from "@dnd-kit/abstract";
import { move } from "@dnd-kit/helpers";

import React, { useEffect, useState } from "react";

interface Element {
	id: string;
	name: string;
    color: string;
	area: string;
}

function Column({ children, id }: { children: React.ReactNode; id: string }) {
	const { isDropTarget, ref } = useDroppable({
		id,
		type: "column",
		accept: "item",
		collisionPriority: CollisionPriority.Low
	});

	const colors: Record<string, string> = {
		S: "bg-red-200",
		A: "bg-orange-200",
		B: "bg-yellow-200",
        C: "bg-green-200",
        F: "bg-blue-200",
	};

	return (
		<div className="flex h-20 flex-row items-center">
			{!id.startsWith("_") ? <div className={colors[id] + " flex h-20 w-20 items-center justify-center rounded-l-xl"}>{id} Tier</div> : <></>}

			<div ref={ref} className={(!id.startsWith("_") ? "rounded-r-xl" : "rounded-xl") +  " bg-viola-100" + " flex h-20 w-full flex-row gap-2 p-2 "}>
				{children}
			</div>
		</div>
	);
}

function Item(props: { element: Element; index: number; column: string }) {
	const { ref, isDragging } = useSortable({
		id: props.element.id,
		index: props.index,
		type: "item",
		accept: "item",
		group: props.column
	});

	return (
		<button className="flex flex-row items-center justify-center gap-2 rounded-xl bg-viola-50 p-2" ref={ref} data-dragging={isDragging}>
			<span className={"h-full w-3 rounded-xl " + props.element.color}></span>

			<div className="flex flex-col p-2">
				<div>{props.element.name}</div>
                <div className="text-xs text-slate-400">{props.element.area}</div>
			</div>
		</button>
	);
}

export default function TierList() {
	const [items, setItems] = useState({
		S: [],
		A: [],
		B: [],
		C: [],
		F: [],
		_: [
			{ id: "heytea", name: "HEYTEA", area: "Harvard Avenue", color: "bg-orange-300" },
			{ id: "ygfmalatang", name: "YGF Malatang", area: "Jamboree Promenade", color: "bg-purple-300" }
		]
	});

    useEffect(() => {
        const items = localStorage.getItem("items");
        if (!items) return;

        console.log(items);

        setItems(JSON.parse(items));
    }, []);

    useEffect(() => {
        localStorage.setItem("items", JSON.stringify(items));
        console.log(items);

    }, [items]);



	const [columnOrder, setColumnOrder] = useState(() => Object.keys(items));

	return (
		<div className="flex flex-col gap-3">
			<DragDropProvider
				onDragOver={(event) => {
					const { source, target } = event.operation;

					if (source?.type === "column") return;

					setItems((items) => move(items, event));
				}}
				onDragEnd={(event) => {
					const { source, target } = event.operation;

					// @ts-expect-error Testing
					if (event.canceled || source.type !== "column") return;

					setColumnOrder((columns) => move(columns, event));
				}}
			>
				{Object.entries(items).map(([column, items]) => (
					<Column key={column} id={column}>
						{items.map((element, index) => (
							<Item key={element.name} element={element} index={index} column={column} />
						))}
					</Column>
				))}
			</DragDropProvider>
		</div>
	);
}
