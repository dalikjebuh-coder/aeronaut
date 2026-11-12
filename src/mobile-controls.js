export function joystickVector(x,y,radius){
  const length=Math.hypot(x,y);
  const scale=length>radius?radius/length:1;
  return {x:x*scale/radius,y:y*scale/radius};
}

export function installMobileControls({joystick,thumb,buttons,enabled=()=>true}){
  let joystickPointer=null;
  const buttonPointers=new Map();
  const axes={roll:0,pitch:0};
  const power=new Set();
  joystick.addEventListener('contextmenu',event=>event.preventDefault());
  function move(event){
    if(event.pointerId!==joystickPointer)return;
    const bounds=joystick.getBoundingClientRect();
    const radius=Math.min(bounds.width,bounds.height)*.34;
    const value=joystickVector(event.clientX-bounds.left-bounds.width/2,event.clientY-bounds.top-bounds.height/2,radius);
    axes.roll=value.x;
    axes.pitch=value.y;
    thumb.style.transform=`translate(${value.x*radius}px,${value.y*radius}px)`;
  }
  joystick.addEventListener('pointerdown',event=>{
    if(!enabled()||joystickPointer!==null)return;
    event.preventDefault();
    joystickPointer=event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    move(event);
  });
  joystick.addEventListener('pointermove',move);
  function releaseJoystick(event){
    if(event.pointerId!==joystickPointer)return;
    joystickPointer=null;
    axes.roll=axes.pitch=0;
    thumb.style.transform='translate(0,0)';
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,releaseJoystick);
  for(const button of buttons){
    button.addEventListener('contextmenu',event=>event.preventDefault());
    button.addEventListener('pointerdown',event=>{
      if(!enabled()||buttonPointers.has(button))return;
      event.preventDefault();
      buttonPointers.set(button,event.pointerId);
      button.setPointerCapture(event.pointerId);
      power.add(button.dataset.control);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{
      if(buttonPointers.get(button)!==event.pointerId)return;
      buttonPointers.delete(button);
      power.delete(button.dataset.control);
    });
  }
  function reset(){
    const pointer=joystickPointer;
    joystickPointer=null;
    axes.roll=axes.pitch=0;
    thumb.style.transform='translate(0,0)';
    if(pointer!==null&&joystick.hasPointerCapture(pointer))joystick.releasePointerCapture(pointer);
    for(const [button,id] of buttonPointers){
      if(button.hasPointerCapture(id))button.releasePointerCapture(id);
    }
    buttonPointers.clear();
    power.clear();
  }
  return {axes,power,reset};
}
