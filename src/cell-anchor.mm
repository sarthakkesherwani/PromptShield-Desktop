#import <Cocoa/Cocoa.h>
#import <ApplicationServices/ApplicationServices.h>
#include "node_api.h"

// Runs inside PromptShield's main process so the user's existing app permission
// applies. Only Numbers' selected-cell geometry is read. Never reads AXValue.
static id attr(AXUIElementRef element, CFStringRef name) {
 CFTypeRef value = nullptr;
 if (AXUIElementCopyAttributeValue(element,name,&value)!=kAXErrorSuccess) return nil;
 return CFBridgingRelease(value);
}
static napi_value result(napi_env env,const char* status) {
 napi_value out,text; napi_create_object(env,&out);napi_create_string_utf8(env,status,NAPI_AUTO_LENGTH,&text);napi_set_named_property(env,out,"status",text);return out;
}
static napi_value rect(napi_env env,AXUIElementRef element,bool selected=false) {
 NSString* role=attr(element,kAXRoleAttribute);
 if(!selected&&![role isEqualToString:(__bridge NSString*)kAXCellRole])return nullptr;
 id p=attr(element,kAXPositionAttribute),s=attr(element,kAXSizeAttribute);
 if(!p||!s||CFGetTypeID((__bridge CFTypeRef)p)!=AXValueGetTypeID()||CFGetTypeID((__bridge CFTypeRef)s)!=AXValueGetTypeID())return nullptr;
 CGPoint position;CGSize size;
 if(!AXValueGetValue((__bridge AXValueRef)p,(AXValueType)kAXValueCGPointType,&position)||!AXValueGetValue((__bridge AXValueRef)s,(AXValueType)kAXValueCGSizeType,&size)||size.width<=0||size.height<=0)return nullptr;
 napi_value out=result(env,"anchor"),v;
 const char* names[]={"x","y","width","height"};double numbers[]={position.x,position.y,size.width,size.height};
 for(int i=0;i<4;i++){napi_create_double(env,numbers[i],&v);napi_set_named_property(env,out,names[i],v);}return out;
}
static napi_value Anchor(napi_env env,napi_callback_info info) {
 @autoreleasepool {
  NSRunningApplication* app=NSWorkspace.sharedWorkspace.frontmostApplication;
  // Copying from our popover can make PromptShield frontmost. Keep tracking
  // Numbers during that interaction, but never draw over an unrelated app.
  if(app.processIdentifier==NSProcessInfo.processInfo.processIdentifier){
   NSArray* running=[NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.apple.Numbers"];
   if(!running.count)running=[NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.apple.iWork.Numbers"];
   app=running.firstObject;
  }
  if(!app||![@[@"com.apple.Numbers",@"com.apple.iWork.Numbers"] containsObject:app.bundleIdentifier])return result(env,"background");
  if(!AXIsProcessTrusted())return result(env,"accessibility");
  AXUIElementRef root=AXUIElementCreateApplication(app.processIdentifier);
  AXUIElementSetMessagingTimeout(root,.2);
  id focused=attr(root,kAXFocusedUIElementAttribute);
  if(focused&&CFGetTypeID((__bridge CFTypeRef)focused)==AXUIElementGetTypeID()){
   napi_value direct=rect(env,(__bridge AXUIElementRef)focused);if(direct){CFRelease(root);return direct;}
   id ancestor=focused;
   for(int level=0;level<6;level++){
    ancestor=attr((__bridge AXUIElementRef)ancestor,kAXParentAttribute);
    if(!ancestor||CFGetTypeID((__bridge CFTypeRef)ancestor)!=AXUIElementGetTypeID())break;
    NSString* role=attr((__bridge AXUIElementRef)ancestor,kAXRoleAttribute);
    if([role isEqualToString:(__bridge NSString*)kAXCellRole]){direct=rect(env,(__bridge AXUIElementRef)ancestor);if(direct){CFRelease(root);return direct;}}
    if([role isEqualToString:(__bridge NSString*)kAXTableRole]&&[attr((__bridge AXUIElementRef)focused,kAXRoleAttribute) isEqualToString:(__bridge NSString*)kAXTextFieldRole]){direct=rect(env,(__bridge AXUIElementRef)focused,true);if(direct){CFRelease(root);return direct;}}
   }
  }
  NSMutableArray* queue=[NSMutableArray arrayWithObject:(__bridge id)root];CFRelease(root);
  CFAbsoluteTime deadline=CFAbsoluteTimeGetCurrent()+.5;NSUInteger cursor=0;
  while(cursor<queue.count&&cursor<2500&&CFAbsoluteTimeGetCurrent()<deadline){
   id candidate=queue[cursor++];if(CFGetTypeID((__bridge CFTypeRef)candidate)!=AXUIElementGetTypeID())continue;
   AXUIElementRef element=(__bridge AXUIElementRef)candidate;
   NSArray* selected=attr(element,CFSTR("AXSelectedCells"));
   if([selected isKindOfClass:NSArray.class]&&selected.count==1){napi_value found=rect(env,(__bridge AXUIElementRef)selected[0],true);if(found)return found;}
   NSString* role=attr(element,kAXRoleAttribute);
   if([role isEqualToString:(__bridge NSString*)kAXCellRole]&&[attr(element,kAXSelectedAttribute) boolValue]){napi_value found=rect(env,element);if(found)return found;}
   NSArray* children=attr(element,kAXChildrenAttribute);if([children isKindOfClass:NSArray.class])for(id child in children){if(queue.count>=2500)break;[queue addObject:child];}
  }
  return result(env,"unavailable");
 }
}
static napi_value Init(napi_env env,napi_value exports){napi_value fn;napi_create_function(env,"anchor",NAPI_AUTO_LENGTH,Anchor,nullptr,&fn);napi_set_named_property(env,exports,"anchor",fn);return exports;}
NAPI_MODULE(cell_anchor,Init)
