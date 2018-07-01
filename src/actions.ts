import { FreeAction } from "./enums";

// QIC to extend range is already included in the distance calculation

export default  {
  [FreeAction.FreeAction1]:{ cost: "2t2", income: "t3"},
  [FreeAction.FreeAction2]:{ cost: "4t3", income: "q,4t1"},
  [FreeAction.FreeAction3]:{ cost: "3t3", income: "o,3t1"},
  [FreeAction.FreeAction4]:{ cost: "q", income: "o"},
  [FreeAction.FreeAction5]:{ cost: "4t3", income: "k,4t1"},
  [FreeAction.FreeAction6]:{ cost: "t3", income: "c,t1"},
  [FreeAction.FreeAction7]:{ cost: "k", income: "c"},
  [FreeAction.FreeAction8]:{ cost: "o", income: "c"},
  [FreeAction.FreeAction9]:{ cost: "o", income: "t"}
};